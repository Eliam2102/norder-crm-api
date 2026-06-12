const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/pacientes',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Status GET:', res.statusCode);
      if(parsed.error) console.log(parsed.error);
    } catch(e) { console.log(data); }
  });
});
req.end();
