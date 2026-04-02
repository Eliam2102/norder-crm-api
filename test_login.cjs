const http = require('http');
const reqLogin = http.request('http://localhost:3000/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let d = '';
  res.on('data', chunk => d += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(d);
      if(!data.data || !data.data.token) return console.log('Login fail', data);
      
      const reqMet = http.request('http://localhost:3000/api/dashboard/metricas', {
        headers: { 'Authorization': 'Bearer ' + data.data.token }
      }, (resMet) => {
        let m = '';
        resMet.on('data', chunk => m+=chunk);
        resMet.on('end', () => console.log('STATUS:', resMet.statusCode, 'DATA:', m));
      });
      reqMet.end();
    } catch(e) { console.log('Parse error', e, d) }
  });
});
reqLogin.write(JSON.stringify({email:'eyder@norder.mx',password:'Norder2026!'}));
reqLogin.end();
