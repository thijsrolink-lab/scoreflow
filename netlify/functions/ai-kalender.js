// Netlify Function: AI Kalender Generator
// Draait server-side — API key veilig als environment variable
// Frontend roept aan via: POST /.netlify/functions/ai-kalender

exports.handler = async function(event, context) {
  // Alleen POST toestaan
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // API key uit environment (stel in via Netlify dashboard → Site settings → Environment variables)
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY niet ingesteld in Netlify environment variables.' })
    };
  }

  var body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ongeldige JSON' }) };
  }

  var input = body.input;
  var van = body.van;
  var tot = body.tot;

  if (!input || !van || !tot) {
    return { statusCode: 400, body: JSON.stringify({ error: 'input, van en tot zijn verplicht' }) };
  }

  var prompt = 'Genereer een golf wedstrijdkalender op basis van deze beschrijving:\n\n' +
    '"' + input + '"\n\n' +
    'Periode: van ' + van + ' tot en met ' + tot + '.\n\n' +
    'Geef ALLEEN een JSON-array terug, geen uitleg, geen markdown. Elk object bevat:\n' +
    '- naam (string)\n' +
    '- datum (string YYYY-MM-DD)\n' +
    '- tijd (string HH:MM)\n' +
    '- vorm (een van: Stableford, Strokeplay, Modified Stableford, Bogey competition, Team Stableford, Texas Scramble, Matchplay, Skins, Eclectic, Amerikaantje)\n' +
    '- holes (getal: 9 of 18)\n' +
    '- max_deelnemers (getal)\n\n' +
    'Regels:\n' +
    '- Geen wedstrijden op Nederlandse feestdagen (Pasen, Hemelvaart, Pinksteren, Koningsdag 27 april, Bevrijdingsdag 5 mei, Kerst, Nieuwjaar)\n' +
    '- Geef wedstrijden opeenvolgende nummers in de naam als het een serie is (bijv. Herendag 1, Herendag 2)\n' +
    '- Kwalificatiewedstrijden eindigen op " Q" in de naam\n' +
    '- Retourneer ALLEEN geldige JSON array, niets anders';

  try {
    var https = require('https');

    var requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
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
        body: JSON.stringify({ error: 'Anthropic API fout: ' + (errBody.error && errBody.error.message || response.body) })
      };
    }

    var data = JSON.parse(response.body);
    var tekst = (data.content && data.content[0] && data.content[0].text) || '';

    // Strip markdown indien aanwezig
    tekst = tekst.replace(/```json|```/g, '').trim();

    var wedstrijden = JSON.parse(tekst);
    if (!Array.isArray(wedstrijden)) throw new Error('Geen geldige array ontvangen');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wedstrijden: wedstrijden })
    };

  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Fout: ' + e.message })
    };
  }
};
