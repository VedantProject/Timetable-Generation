const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/admin/timetable/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Generate Response:", data);
    try {
        const j = JSON.parse(data);
        if (j.jobId) {
            console.log("Job ID:", j.jobId);
            const int = setInterval(() => {
                http.get(`http://localhost:5000/api/admin/timetable/generate/status/${j.jobId}`, (res2) => {
                    let st = '';
                    res2.on('data', c => st += c);
                    res2.on('end', () => {
                        const sObj = JSON.parse(st);
                        console.log("Status:", sObj.status);
                        if (sObj.status !== 'running') {
                            clearInterval(int);
                            console.log("Final outcome:", sObj);
                        }
                    });
                });
            }, 1000);
        }
    } catch(e) {}
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({ semester: 'Fall 2024', department: 'CSE' }));
req.end();
