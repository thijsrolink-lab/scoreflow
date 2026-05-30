// Netlify Function: Algemene AI Chat Assistent
// Beantwoordt vragen over golf, clubbeheer, wedstrijdregels, etc.
// Houdt conversatie-history bij via de request body

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY niet ingesteld.' })
    };
  }

  var body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Ongeldige JSON' }) }; }

  var messages = body.messages || [];
  var context_info = body.context || {};

  if (!messages.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Geen berichten' }) };
  }

  // Systeem-prompt: golf club assistent context
  var systemPrompt = `Je bent een slimme assistent voor golfclubs en wedstrijdleiders. Je helpt met:

- Vragen over wedstrijdvormen en spelregels (Stableford, Strokeplay, Texas Scramble, Eclectic, Matchplay, Skins, Amerikaantje, etc.)
- Handicap-berekeningen en speelhandicap uitleg
- Clubbeheer en organisatie
- Seizoensplanning en kalender
- Beste praktijken voor wedstrijdleiders
- Flight-indeling en planning
- Uitleg van golftermen en regels
- Communicatie naar leden

Antwoord altijd in het Nederlands. Wees praktisch, bondig en direct.
Gebruik geen lange inleidingen. Geef concrete antwoorden.

${context_info.clubnaam ? 'Clubnaam: ' + context_info.clubnaam : ''}
${context_info.aantalWedstrijden ? 'Aantal wedstrijden dit seizoen: ' + context_info.aantalWedstrijden : ''}
${context_info.aantalSpelers ? 'Aantal leden: ' + context_info.aantalSpelers : ''}`;

  try {
    var https = require('https');

    var requestBody = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',  // Haiku: snel + goedkoop voor chat
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    });

    var response = await new Promise(function(resolve, reject) {
      var req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, function(res) {
        var data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    if (response.status !== 200) {
      var errBody = JSON.parse(response.body);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'API fout: ' + (errBody.error && errBody.error.message || response.body) })
      };
    }

    var data = JSON.parse(response.body);
    var tekst = (data.content && data.content[0] && data.content[0].text) || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ antwoord: tekst })
    };

  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Fout: ' + e.message })
    };
  }
};
