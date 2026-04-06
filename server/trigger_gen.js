const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/admin/timetable/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Generate Triggered:", data);
    const result = JSON.parse(data);
    if (!result.jobId) return;

    // Poll
    const poll = setInterval(() => {
        http.get('http://127.0.0.1:5000/api/admin/timetable/generate/status/'+result.jobId, (statusRes) => {
           let stData = '';
           statusRes.on('data', c => stData += c);
           statusRes.on('end', () => {
              console.log("Status:", stData);
              const statusObj = JSON.parse(stData);
              if (statusObj.status !== 'running') {
                  clearInterval(poll);
              }
           });
        });
    }, 1000);
  });
});

req.write(JSON.stringify({ semester: 'Fall 2024', department: 'CSE' }));
req.end();
