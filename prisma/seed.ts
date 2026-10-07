/**
 * PlacementOS Demo Seed Script
 * Generates realistic placement portal data:
 *   - 1 Tenant (VJTI Mumbai)
 *   - 300 Students (6 branches)
 *   - 100 Companies
 *   - 500 Jobs (FTE + Internship)
 *   - 2000 Applications
 *   - 100 Interview Vault entries
 *   - 50 Placement Events
 *
 * Run: npx ts-node --project tsconfig.json prisma/seed.ts
 */

import { PrismaClient, ApplicationStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Data Constants
// ---------------------------------------------------------------------------

const BRANCHES = ['IT', 'COMPS', 'ETRX', 'MECH', 'CIVIL', 'PROD'];

const COMPANY_NAMES = [
  // Tier 1 — Tech
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Uber', 'Airbnb', 'Stripe', 'Databricks',
  // Tier 2 — Tech (India + Global)
  'Goldman Sachs', 'Morgan Stanley', 'JPMorgan Chase', 'Barclays', 'Deutsche Bank',
  'Oracle', 'SAP', 'Salesforce', 'Workday', 'ServiceNow',
  'Cisco', 'Intel', 'NVIDIA', 'Qualcomm', 'ARM',
  'Adobe', 'Autodesk', 'Figma', 'Atlassian', 'GitHub',
  // Indian Product Companies
  'Zepto', 'Meesho', 'CRED', 'Razorpay', 'PhonePe',
  'Dream11', 'ShareChat', 'Navi', 'Slice', 'Jupiter',
  'Swiggy', 'Zomato', 'Dunzo', 'Blinkit', 'Groww',
  'Ola', 'Rapido', 'Porter', 'BlackBuck', 'Delhivery',
  // Consulting & Services
  'Accenture', 'Deloitte', 'McKinsey', 'BCG', 'Bain',
  'TCS', 'Infosys', 'Wipro', 'HCL', 'Tech Mahindra',
  'Cognizant', 'Capgemini', 'L&T Technology', 'Mphasis', 'Hexaware',
  // Core / Manufacturing
  'Siemens', 'ABB', 'Honeywell', 'Bosch', 'Tata Motors',
  'Mahindra', 'Larsen & Toubro', 'BHEL', 'ISRO', 'DRDO',
  // Startups
  'Postman', 'BrowserStack', 'Browserbase', 'Hasura', 'Appsmith',
  'Polygon', 'Coinbase', 'CoinDCX', 'WazirX', 'Mudrex',
  'Licious', 'Country Delight', 'Nykaa', 'Mamaearth', 'boAt',
  'Unacademy', 'BYJU\'s', 'Vedantu', 'upGrad', 'Simplilearn',
];

const JOB_TITLES = [
  'Software Development Engineer', 'Graduate Engineer Trainee', 'Associate Software Engineer',
  'Full Stack Developer', 'Backend Engineer', 'Frontend Engineer',
  'Data Engineer', 'DevOps Engineer', 'Site Reliability Engineer',
  'Product Analyst', 'Business Analyst', 'Systems Engineer',
  'Embedded Engineer', 'VLSI Design Engineer', 'Research Engineer',
  'Quantitative Analyst', 'Risk Analyst', 'Technology Analyst',
  'Software Engineer Intern', 'Data Science Intern', 'Product Management Intern',
];

const TECH_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Java', 'C++', 'Go',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'Docker',
  'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'Linux', 'REST APIs',
  'GraphQL', 'gRPC', 'Spark', 'TensorFlow', 'PyTorch', 'SQL',
  'System Design', 'Data Structures', 'Algorithms', 'OOP',
];

const INTERVIEW_TOPICS = [
  { topic: 'Binary Trees', category: 'DSA' },
  { topic: 'Dynamic Programming', category: 'DSA' },
  { topic: 'Graph BFS/DFS', category: 'DSA' },
  { topic: 'Arrays & Two Pointers', category: 'DSA' },
  { topic: 'Sliding Window', category: 'DSA' },
  { topic: 'Heap & Priority Queue', category: 'DSA' },
  { topic: 'Tries', category: 'DSA' },
  { topic: 'Segment Trees', category: 'DSA' },
  { topic: 'SQL Joins', category: 'DBMS' },
  { topic: 'Normalization', category: 'DBMS' },
  { topic: 'Indexing', category: 'DBMS' },
  { topic: 'Transaction Isolation', category: 'DBMS' },
  { topic: 'Process Scheduling', category: 'OS' },
  { topic: 'Memory Management', category: 'OS' },
  { topic: 'Deadlock Detection', category: 'OS' },
  { topic: 'Virtual Memory', category: 'OS' },
  { topic: 'Load Balancing', category: 'System Design' },
  { topic: 'Consistent Hashing', category: 'System Design' },
  { topic: 'Database Sharding', category: 'System Design' },
  { topic: 'CAP Theorem', category: 'System Design' },
];

const EVENT_TYPES = ['PPT', 'OA', 'INTERVIEW', 'OFFER', 'RESULT', 'DEADLINE'];

const INDUSTRIES = ['Technology', 'Finance', 'E-Commerce', 'Consulting', 'Manufacturing', 'Healthcare', 'EdTech'];

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date;
}

function generateEmail(name: string, index: number, domain: string) {
  return `${name.toLowerCase().replace(/\s/g, '.')}${index}@${domain}`;
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Starting PlacementOS demo seed...');

  // Clean existing data
  await prisma.aIResult.deleteMany();
  await prisma.placementEvent.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.interviewVault.deleteMany();
  await prisma.studentSentiment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.readinessHistory.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.job.deleteMany();
  await prisma.company.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tenant.deleteMany();
  console.log('✅ Cleaned existing data');

  // 1. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'VJTI Mumbai',
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // 2. Create 100 Companies
  const companies = await Promise.all(
    COMPANY_NAMES.slice(0, 100).map((name) =>
      prisma.company.create({
        data: {
          tenantId: tenant.id,
          name,
          industry: randomItem(INDUSTRIES),
          description: `${name} is a leading organization in ${randomItem(INDUSTRIES)} with a strong campus presence at VJTI.`,
          visitCount: randomInt(1, 8),
          trustScore: randomFloat(3.5, 5.0, 1),
        },
      })
    )
  );
  console.log(`✅ Created ${companies.length} companies`);

  // 3. Create 500 Jobs (5 per company)
  const jobs: { id: string; tenantId: string; companyId: string; minCgpa: number; requiredSkills: string[]; packageLpa: number }[] = [];
  for (const company of companies) {
    const jobCount = randomInt(3, 7);
    for (let j = 0; j < jobCount && jobs.length < 500; j++) {
      const isInternship = Math.random() < 0.25;
      const job = await prisma.job.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          title: randomItem(JOB_TITLES),
          description: `Join ${company.name} as a ${isInternship ? 'intern' : 'full-time'} engineer. Work on cutting-edge technology problems.`,
          minCgpa: randomFloat(7.0, 9.0, 1),
          requiredSkills: randomItems(TECH_SKILLS, randomInt(3, 6)),
          packageLpa: isInternship ? randomFloat(3, 12, 1) : randomFloat(8, 45, 1),
          type: isInternship ? 'INTERNSHIP' : 'FTE',
        },
      });
      jobs.push(job);
    }
  }
  console.log(`✅ Created ${jobs.length} jobs`);

  // 4. Create 300 Students (50 per branch)
  const students: { id: string; tenantId: string; cgpa: number; skills: string[]; branch: string }[] = [];
  for (const branch of BRANCHES) {
    for (let s = 0; s < 50; s++) {
      const firstName = ['Arjun', 'Priya', 'Rohan', 'Sneha', 'Vivek', 'Ananya', 'Karan', 'Pooja', 'Rahul', 'Divya'][randomInt(0, 9)];
      const lastName = ['Sharma', 'Patil', 'Joshi', 'Kulkarni', 'Desai', 'More', 'Kadam', 'Pawar', 'Shah', 'Gupta'][randomInt(0, 9)];
      const name = `${firstName} ${lastName}`;
      const cgpa = randomFloat(6.5, 9.8, 2);
      const rollNum = `22${branch.slice(0, 2).toUpperCase()}${String(s + 1).padStart(3, '0')}`;

      const student = await prisma.student.create({
        data: {
          tenantId: tenant.id,
          studentId: rollNum,
          name,
          email: generateEmail(name, students.length, 'it.vjti.ac.in'),
          passwordHash: '$argon2id$v=19$mock_hash_for_seed_data_only',
          encryptedPhone: `encrypted:+91-9${randomInt(100000000, 999999999)}`,
          encryptedPersonalEmail: `encrypted:${name.toLowerCase().replace(/\s/g, '')}@gmail.com`,
          cgpa,
          branch,
          skills: randomItems(TECH_SKILLS, randomInt(3, 8)),
          codingScore: randomInt(200, 950),
        },
      });
      students.push(student);
    }
  }
  console.log(`✅ Created ${students.length} students`);

  // 5. Create ~2000 Applications (weighted by CGPA → package match)
  let applicationCount = 0;
  const applicationSet = new Set<string>();

  for (const student of students) {
    // High CGPA students apply to more + better companies
    const numApplications = student.cgpa >= 8.5 ? randomInt(8, 15) : student.cgpa >= 7.5 ? randomInt(5, 10) : randomInt(2, 6);
    const eligibleJobs = jobs.filter((j) => j.minCgpa <= student.cgpa);
    const selectedJobs = randomItems(eligibleJobs, Math.min(numApplications, eligibleJobs.length));

    for (const job of selectedJobs) {
      const key = `${student.id}-${job.id}`;
      if (applicationSet.has(key) || applicationCount >= 2000) continue;
      applicationSet.add(key);

      // Simulate progression — high CGPA more likely to advance
      let status: ApplicationStatus = 'APPLIED';
      const rand = Math.random();
      if (rand > 0.7) status = 'OA_CLEARED';
      if (rand > 0.85) status = 'INTERVIEW_ROUND';
      if (rand > 0.93 && student.cgpa >= 7.5) status = 'SELECTED';
      if (rand < 0.05) status = 'REJECTED';

      const timeline: { status: string; timestamp: string; note: string }[] = [
        { status: 'APPLIED', timestamp: randomDate(200).toISOString(), note: 'Application submitted through PlacementOS.' },
      ];
      if (['OA_CLEARED', 'INTERVIEW_ROUND', 'SELECTED'].includes(status)) {
        timeline.push({ status: 'OA_CLEARED', timestamp: randomDate(170).toISOString(), note: 'Online assessment cleared.' });
      }
      if (['INTERVIEW_ROUND', 'SELECTED'].includes(status)) {
        timeline.push({ status: 'INTERVIEW_ROUND', timestamp: randomDate(140).toISOString(), note: 'Technical interview completed.' });
      }
      if (status === 'SELECTED') {
        timeline.push({ status: 'SELECTED', timestamp: randomDate(100).toISOString(), note: 'Offer extended. Congratulations!' });
      }

      await prisma.application.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          jobId: job.id,
          status,
          timelineHistory: timeline,
        },
      });
      applicationCount++;
    }
  }
  console.log(`✅ Created ${applicationCount} applications`);

  // 6. Create 100 Interview Vault Entries
  const vaultEntries = [];
  for (let vi = 0; vi < 100; vi++) {
    const topicData = INTERVIEW_TOPICS[vi % INTERVIEW_TOPICS.length];
    const company = companies[vi % companies.length];

    vaultEntries.push(
      await prisma.interviewVault.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          roleName: randomItem(JOB_TITLES),
          topic: topicData.topic,
          question: generateVaultQuestion(topicData.topic, topicData.category),
          difficulty: randomItem(['Easy', 'Medium', 'Hard']),
        },
      })
    );
  }
  console.log(`✅ Created ${vaultEntries.length} interview vault entries`);

  // 7. Create 50 Placement Events
  for (let i = 0; i < 50; i++) {
    const company = companies[i % companies.length];
    const eventType = EVENT_TYPES[i % EVENT_TYPES.length];
    const daysFromNow = randomInt(-60, 90);
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + daysFromNow);

    await prisma.placementEvent.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        title: `${company.name} ${eventType}`,
        type: eventType,
        date: eventDate,
      },
    });
  }
  console.log('✅ Created 50 placement events');

  console.log('\n🎉 Seed complete!');
  console.log(`📊 Summary:
    Tenant: ${tenant.name}
    Companies: ${companies.length}
    Jobs: ${jobs.length}
    Students: ${students.length}
    Applications: ${applicationCount}
    Vault Entries: ${vaultEntries.length}
    Events: 50`);
}

function generateVaultQuestion(topic: string, category: string): string {
  const questions: Record<string, string[]> = {
    DSA: [
      `Given a ${topic} problem, write an algorithm with O(n log n) time complexity.`,
      `Implement ${topic} traversal and find the kth largest element.`,
      `Solve the ${topic} variant with space optimization.`,
    ],
    DBMS: [
      `Write a SQL query using ${topic} to find duplicate records.`,
      `Explain ${topic} and when you would use it in production.`,
      `Design a schema demonstrating ${topic} principles.`,
    ],
    OS: [
      `Explain the ${topic} algorithm and compare with alternatives.`,
      `How does ${topic} prevent system deadlocks?`,
      `Describe a real scenario where ${topic} is critical.`,
    ],
    'System Design': [
      `Design a system using ${topic} for a 10M user platform.`,
      `How would you implement ${topic} in a distributed environment?`,
      `What are the trade-offs of ${topic} in CAP theorem context?`,
    ],
  };

  const categoryQuestions = questions[category] || questions['DSA'];
  return categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
