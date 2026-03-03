// Script to add photography jobs to Mission Control V6
import { pushData } from './src/lib/firebase';

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
    notes: 'Good fit for Oleg - matches event photography experience. Flexible freelance work.',
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
    notes: 'Part-time opportunity with local events company. Good for building portfolio.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
    addedAt: new Date().toISOString(),
  },
  {
    title: 'Freelance Photographer - Various Projects',
    company: 'Upwork Clients',
    location: 'Remote/Seattle, WA',
    type: 'freelance',
    status: 'new',
    source: 'Upwork.com',
    url: 'https://www.upwork.com/hire/photographers/us/seattle-wa/',
    description: 'Multiple freelance photography opportunities on Upwork platform. Projects range from product photography to portraits, events, and commercial work. Set your own rates and schedule.',
    requirements: ['Upwork profile', 'Portfolio samples', 'Client communication skills', 'Reliable delivery'],
    salary: 'Varies by project',
    datePosted: '2025-03-01',
    priority: 'medium',
    tags: ['freelance', 'remote', 'upwork', 'various'],
    notes: 'Platform with multiple clients. Good for steady freelance work and building client base.',
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
    notes: 'Direct client through Twine. Good per-event pay rate.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
    addedAt: new Date().toISOString(),
  },
];

async function addJobs() {
  for (const job of jobs) {
    try {
      await pushData('v6/jobs', job);
      console.log(`Added job: ${job.title} at ${job.company}`);
    } catch (err) {
      console.error(`Failed to add job: ${job.title}`, err);
    }
  }
  console.log('Done adding jobs!');
}

addJobs();