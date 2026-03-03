#!/usr/bin/env node
/**
 * Direct Firebase Database Writer for Mission Control V6
 */

import https from 'https';

const DATABASE_URL = 'mission-control-sync-default-rtdb.firebaseio.com';

function pushData(path, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    const options = {
      hostname: DATABASE_URL,
      port: 443,
      path: `/${path}.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonData.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.write(jsonData);
    req.end();
  });
}

// Jobs to add
const jobs = [
  {
    title: 'Event Photographer - Freelance',
    company: 'Shootday',
    location: 'Seattle, WA',
    type: 'freelance',
    status: 'new',
    source: 'theCreativeloft.com',
    url: 'https://photography.thecreativeloft.com/photography/jobs/seattle-event-photograph',
    description: 'Looking for freelance photographers to work on a variety of events including corporate functions, product launches, and social gatherings. Must have excellent knowledge of equipment and ability to capture high-quality photos of participants during events.',
    requirements: ['Own photography equipment', 'Event photography experience', 'Professional portfolio', 'Reliable transportation'],
    salary: '$17-42/hr',
    datePosted: '2025-01-09',
    priority: 'high',
    tags: ['event', 'freelance', 'corporate', 'seattle'],
    notes: 'Found by KimiClaw - Good fit for Oleg, matches event photography experience. Flexible freelance work.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
    addedAt: new Date().toISOString(),
  },
  {
    title: 'Part-Time Event Photographer',
    company: 'Local Events Company',
    location: 'Seattle-Tacoma, WA',
    type: 'part-time',
    status: 'new',
    source: 'theCreativeloft.com',
    url: 'https://photography.thecreativeloft.com/photography/Photographer/jobs/in/seattle-tacoma/',
    description: 'Seeking part-time photographers to work events in the Seattle-Tacoma area. Looking for talented photographers passionate about their work, eager to hone their skills and embrace creative expression.',
    requirements: ['Photography portfolio', 'Weekend availability', 'Professional demeanor', 'Quick photo editing'],
    salary: '$25-35/hr',
    datePosted: '2025-02-15',
    priority: 'medium',
    tags: ['event', 'part-time', 'seattle', 'tacoma'],
    notes: 'Found by KimiClaw - Part-time opportunity with local events company. Good for building portfolio.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
    addedAt: new Date().toISOString(),
  },
  {
    title: 'Event Photographer',
    company: 'Twine / Shootday',
    location: 'Seattle, Washington',
    type: 'freelance',
    status: 'new',
    source: 'Twine.net',
    url: 'https://www.twine.net/projects/b8s910-shootday-event-photographer-in-seattle-washington-photographer-in-seattle-united-states-job',
    description: 'Twine Jobs is looking for an Event Photographer in Seattle. Work on various events and build your portfolio with professional clients.',
    requirements: ['Event photography experience', 'Professional camera gear', 'Editing software', 'Reliable transportation'],
    salary: '$200-500 per event',
    datePosted: '2025-02-20',
    priority: 'high',
    tags: ['event', 'freelance', 'twine', 'seattle'],
    notes: 'Found by KimiClaw - Direct client through Twine. Good per-event pay rate.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
    addedAt: new Date().toISOString(),
  },
];

async function main() {
  console.log('Adding jobs to Firebase...\n');
  
  for (const job of jobs) {
    try {
      const result = await pushData('v6/jobs', job);
      console.log(`✅ Added: ${job.title} at ${job.company}`);
      console.log(`   ID: ${result.name}\n`);
    } catch (err) {
      console.error(`❌ Failed: ${job.title}`, err.message);
    }
  }
  
  console.log('Done! Check Mission Control V6 Jobs tab.');
}

main();