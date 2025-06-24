const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Card = require('../models/cardModel');
const User = require('../models/User');

dotenv.config({ path: __dirname + '/../.env' });

async function seedSampleCards() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Find an admin user to assign as the card owner
  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    console.error('No admin user found. Please seed an admin user first.');
    process.exit(1);
  }

  const cards = [
    {
      user: adminUser._id,
      nfcId: 'nfc-corp-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'corporate',
      organization: 'TechCorp',
      status: 'active',
      customFields: {
        companyName: 'TechCorp Solutions',
        tagline: 'Innovative Technology Solutions',
        industries: 'Technology, Consulting, Enterprise',
        services: 'Enterprise Solutions, Cloud Services, Cybersecurity, Business Analytics',
        solutions: 'Solution 1, Solution 2, Solution 3',
        contactOptions: 'Schedule Meeting, Contact Sales, Request Quote, Visit Website',
        socialLinks: 'LinkedIn, Twitter, Facebook, YouTube'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-restaurant-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'restaurant',
      organization: 'Tasty Bites',
      status: 'active',
      customFields: {
        restaurantName: 'Sunrise Cafe',
        tagline: 'Fresh Flavors, Cozy Atmosphere',
        menu: 'Avocado Toast, Cappuccino, Eggs Benedict, Berry Pancakes',
        reviews: 'Best brunch spot in town! Cozy place, great coffee.',
        contactOptions: 'Reserve Table, Call, Visit Website, Get Directions'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-freelancer-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'freelancer',
      organization: 'Freelance Pro',
      status: 'inactive',
      customFields: {
        profileName: 'Jane Doe',
        profileTitle: 'Web Designer & Illustrator',
        skills: 'Web Design, Branding, Illustration',
        services: 'Branding, Web Design, Illustration',
        portfolio: 'janedoe.com',
        contactOptions: 'Email, Call, Book Meeting',
        socialLinks: 'LinkedIn, Twitter, Instagram, Behance'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-event-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'event',
      organization: 'FutureTech Summit',
      status: 'active',
      customFields: {
        eventTitle: 'FutureTech Summit 2024',
        eventDateLocation: 'March 15-17, 2024, San Francisco, CA',
        agenda: 'Registration, Keynote, Panel, Workshop, Networking',
        speakers: 'Dr. Jane Lee, Carlos Rivera, Priya Patel',
        networking: 'Connect with Attendees, Book 1:1 Meeting, Event Website'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-edu-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'education',
      organization: 'Greenfield High School',
      status: 'active',
      customFields: {
        teacherName: 'Ms. Olivia Brown',
        teacherTitle: 'Mathematics Teacher',
        school: 'Greenfield High School',
        status: 'Available for Tutoring',
        schedule: 'Mon 9:00 Algebra I, Tue 11:00 Geometry, Wed 14:00 Calculus, Thu 10:00 Statistics',
        resources: 'Syllabus, Online Portal, Assignment Guide',
        contactOptions: 'Email, Call, Book Meeting'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-health-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'healthcare',
      organization: 'City Health Clinic',
      status: 'active',
      customFields: {
        doctorName: 'Dr. Emily Carter',
        doctorSpecialty: 'Cardiologist',
        credentials: 'MD, FACC, Board Certified',
        status: 'Accepting New Patients',
        services: 'Cardiac Consultation, Heart Health Screening, Preventive Care, Telemedicine',
        contactOptions: 'Book Appointment, Call Clinic, Email, Visit Website',
        emergencyContact: '911'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-nonprofit-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'nonprofit',
      organization: 'Green Earth Foundation',
      status: 'active',
      customFields: {
        orgName: 'Green Earth Foundation',
        orgMission: 'Protecting the planet through community action and education.',
        status: 'Nonprofit Organization',
        actions: 'Donate, Volunteer, Join Community',
        impact: 'Planted 10,000+ trees, Hosted 50+ workshops, Supported 200+ events',
        contactOptions: 'Email, Call, Visit Website'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-realestate-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'real-estate',
      organization: 'DreamHome Realty',
      status: 'active',
      customFields: {
        agentName: 'Jordan Lee',
        agentTitle: 'Real Estate Agent',
        agency: 'DreamHome Realty',
        status: 'Available for Showings',
        listings: 'Modern 2BR Condo, Family Home w/ Garden',
        contactOptions: 'Book Tour, Call, Email, Visit Website'
      }
    },
    {
      user: adminUser._id,
      nfcId: 'nfc-portfolio-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      template: 'portfolio',
      organization: 'Alex Smith',
      status: 'active',
      customFields: {
        profileName: 'Alex Smith',
        profileTitle: 'Web Developer & Designer',
        resume: 'View Resume',
        skills: 'HTML, CSS, JavaScript, React, UI/UX',
        portfolio: 'alexsmith.com',
        contactOptions: 'Email, Call, Book Meeting',
        socialLinks: 'LinkedIn, GitHub, Twitter, Dribbble'
      }
    }
  ];

  await Card.deleteMany({});
  await Card.insertMany(cards);
  console.log('Sample NFC cards seeded successfully!');
  process.exit();
}

seedSampleCards().catch(err => {
  console.error(err);
  process.exit(1);
}); 