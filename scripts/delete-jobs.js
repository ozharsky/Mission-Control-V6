#!/usr/bin/env node
/**
 * Delete jobs from Firebase by ID
 */

import https from 'https';

const DATABASE_URL = 'mission-control-sync-default-rtdb.firebaseio.com';

// Job IDs to delete (from the test)
const JOB_IDS_TO_DELETE = [
  '-Omm2qMaH0SWB4eEi3pc',
  '-Omm2qPrGxpzpriwu8Cz',
  '-Omm2qT5VdATWDg9fcBI'
];

function deleteData(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: DATABASE_URL,
      port: 443,
      path: `/${path}.json`,
      method: 'DELETE'
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        resolve(responseData || 'OK');
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Deleting test jobs from Firebase...\n');
  
  for (const jobId of JOB_IDS_TO_DELETE) {
    try {
      await deleteData(`v6/jobs/${jobId}`);
      console.log(`✅ Deleted job: ${jobId}`);
    } catch (err) {
      console.error(`❌ Failed to delete: ${jobId}`, err.message);
    }
  }
  
  console.log('\nDone! Test jobs removed.');
}

main();