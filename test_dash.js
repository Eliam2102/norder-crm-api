import http from 'http';

const reqLogin = http.request('http://localhost:3000/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let d = '';
  res.on('data', chunk => d += chunk);
  res.on('end', () => {
    try {
      const { data } = JSON.parse(d);
      if(!data || !data.token) return;
      
      const endpoints = ['/api/dashboard/metricas', '/api/dashboard/alertas', '/api/dashboard/top-clientes', '/api/pacientes'];
      
      endpoints.forEach(ep => {
          const r = http.request(`http://localhost:3000${ep}`, {
            headers: { 'Authorization': 'Bearer ' + data.token }
          }, resEp => {
            let m = '';
            resEp.on('data', chunk => m+=chunk);
            resEp.on('end', () => console.log(ep, '=> STATUS:', resEp.statusCode, 'DATA:', m.slice(0,100)));
          });
          r.end();
      });
      
    } catch(e) {}
  });
});
reqLogin.write(JSON.stringify({email:'eyder@norder.mx',password:'Norder2026!'}));
reqLogin.end();
