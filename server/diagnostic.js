const http = require('http');

const testLogin = (username, password) => {
  const data = JSON.stringify({ username, password });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`BODY: ${body}`);
      if (res.statusCode === 200) {
        console.log('✅ DIAGNOSTIC PASSED: Login accepted by server.');
      } else {
        console.log('❌ DIAGNOSTIC FAILED: Login rejected by server.');
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ CONNECTION ERROR: ${e.message}`);
    console.log('Is the server running on port 3001?');
  });

  req.write(data);
  req.end();
};

console.log('🚀 Running Login Diagnostic...');
console.log('Testing: youth_lead / leader123');
testLogin('youth_lead', 'leader123');
