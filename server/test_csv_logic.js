const { v4: uuidv4 } = require('uuid');

// The logic I implemented
const getValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      const val = String(row[key]).trim();
      if (val) return val;
    }
  }
  return null;
};

// Mock data representing the user's snake_case CSV
const mockRows = [
  {
    membership_id: 'TEST001',
    full_name: 'Test Member',
    section_id: '1',
    leader_id: '2',
    phone: '1234567890',
    email: 'test@example.com',
    gender: 'Male',
    age_group: 'Adult',
    address: '123 Test St'
  },
  {
    MembershipID: 'TEST002',
    FullName: 'Pascal Member',
    Section: 'Main Section',
    LeaderName: 'Main Leader',
    Phone: '0987654321',
    Email: 'pascal@example.com',
    Gender: 'Female',
    AgeGroup: 'Teen',
    Address: '456 Pascal Ave'
  }
];

function test() {
  console.log('--- Testing CSV Logic ---');
  
  mockRows.forEach((row, index) => {
    console.log(`\nTesting Row ${index + 1}:`);
    const fullName = getValue(row, ['FullName', 'full_name', 'Name']);
    const membershipId = getValue(row, ['MembershipID', 'membership_id', 'id']);
    const sectionNameOrId = getValue(row, ['Section', 'section_id', 'section_name', 'SectionName']);
    const leaderNameOrId = getValue(row, ['LeaderName', 'leader_id', 'leader_name', 'Leader']);
    const phone = getValue(row, ['Phone', 'phone', 'member_phone', 'Mobile']);
    const address = getValue(row, ['Address', 'address', 'AddressLine1']);

    console.log(`FullName: ${fullName}`);
    console.log(`MembershipID: ${membershipId}`);
    console.log(`SectionNameOrId: ${sectionNameOrId}`);
    console.log(`LeaderNameOrId: ${leaderNameOrId}`);
    console.log(`Phone: ${phone}`);
    console.log(`Address: ${address}`);

    if (fullName && membershipId && sectionNameOrId && leaderNameOrId) {
      console.log('✅ PASS: Required fields found');
      
      if (/^\d+$/.test(sectionNameOrId)) {
        console.log(`- Resolved as Numeric ID: ${sectionNameOrId}`);
      } else {
        console.log(`- Resolved as Name: ${sectionNameOrId}`);
      }
    } else {
      console.log('❌ FAIL: Missing required fields');
    }
  });
}

test();
