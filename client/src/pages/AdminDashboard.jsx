import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [sections, setSections] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sectionsRes, membersRes] = await Promise.all([
        adminAPI.getSections(),
        adminAPI.getMembers()
      ]);
      setSections(sectionsRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await adminAPI.uploadCSV(file);
      setUploadResult(result.data);
      loadData();
    } catch (error) {
      alert(`Upload failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b">
          {['dashboard', 'members', 'upload', 'leaders'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition ${
                activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Total Members</h3>
              <p className="text-4xl font-bold text-blue-600">{members.length}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Total Sections</h3>
              <p className="text-4xl font-bold text-green-600">{sections.length}</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
              <p className="text-2xl font-bold text-purple-600">System Active</p>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">All Members</h3>
              <input
                type="text"
                placeholder="Search members..."
                className="border rounded px-3 py-2"
                onChange={(e) => {
                  const term = e.target.value.toLowerCase();
                  const filtered = members.filter(m =>
                    m.full_name.toLowerCase().includes(term) ||
                    m.membership_id.toLowerCase().includes(term) ||
                    m.section_name?.toLowerCase().includes(term)
                  );
                  setMembers(filtered);
                }}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{member.membership_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{member.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{member.section_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{member.leader_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{member.phone || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Upload CSV</h3>
            <p className="text-gray-600 mb-4">
              Upload a CSV file with member data. Expected columns:
              MembershipID, FullName, Section, LeaderName, Phone, Email, Gender, AgeGroup
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleUpload}
                disabled={loading}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer inline-block"
              >
                <div className="text-6xl mb-4">📁</div>
                <p className="text-lg font-medium text-gray-700">
                  {loading ? 'Processing...' : 'Click to upload CSV file'}
                </p>
                <p className="text-sm text-gray-500">or drag and drop</p>
              </label>
            </div>

            {uploadResult && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">Upload Complete!</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>Sections created: {uploadResult.results.sectionsCreated}</li>
                  <li>Leaders created: {uploadResult.results.leadersCreated}</li>
                  <li>Members created: {uploadResult.results.membersCreated}</li>
                  {uploadResult.tempPasswords && (
                    <li className="font-bold text-orange-600">⚠️ Temporary passwords generated for new leader accounts</li>
                  )}
                </ul>
                {uploadResult.results.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-600 font-medium">View Errors ({uploadResult.results.errors.length})</summary>
                    <ul className="mt-2 text-sm text-red-700 space-y-1">
                      {uploadResult.results.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Leaders Tab */}
        {activeTab === 'leaders' && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Section Leaders</h3>
            <p className="text-gray-500">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
