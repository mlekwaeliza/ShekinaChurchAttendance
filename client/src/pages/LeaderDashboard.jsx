import React, { useState, useEffect } from 'react';
import { leaderAPI } from '../services/api';

const LeaderDashboard = () => {
  const [members, setMembers] = useState([]);
  const [sectionInfo, setSectionInfo] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    checkSubmission();
  }, [selectedDate]);

  const loadMembers = async () => {
    try {
      const response = await leaderAPI.getMembers();
      setSectionInfo({
        name: response.data.section_name,
        leader: response.data.leader_name
      });
      setMembers(response.data.members);

      // Initialize attendance state
      const initial = {};
      response.data.members.forEach(m => {
        initial[m.id] = 'present';
      });
      setAttendance(initial);
    } catch (error) {
      alert('Failed to load members');
    }
  };

  const checkSubmission = async () => {
    try {
      const response = await leaderAPI.getAttendanceStatus(selectedDate);
      setSubmitted(response.data.submitted);
      if (response.data.attendance) {
        const existing = {};
        response.data.attendance.forEach(a => {
          existing[a.member_id] = a.status;
        });
        setAttendance(existing);
      }
    } catch (error) {
      console.error('Failed to check submission:', error);
    }
  };

  const handleStatusChange = (memberId, status) => {
    if (submitted) return;
    setAttendance(prev => ({ ...prev, [memberId]: status }));
  };

  const handleSubmit = async () => {
    if (submitted) {
      alert('Attendance already submitted for this date');
      return;
    }

    setLoading(true);
    try {
      const attendanceArray = Object.entries(attendance).map(([member_id, status]) => ({
        member_id: parseInt(member_id),
        status
      }));

      await leaderAPI.submitAttendance(selectedDate, attendanceArray);
      setSubmitted(true);
      setMessage('Attendance submitted successfully!');
    } catch (error) {
      alert(`Failed to submit: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!sectionInfo) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-2">Attendance - {sectionInfo.name}</h2>
        <p className="text-gray-600 mb-4">Leader: {sectionInfo.leader}</p>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        {/* Date Selector */}
        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Select Sunday</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={submitted}
            className="border rounded px-3 py-2"
          />
          {submitted && (
            <p className="text-green-600 text-sm mt-2">✓ Submitted on {selectedDate}</p>
          )}
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map(member => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{member.membership_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{member.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{member.phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {['present', 'absent', 'excused'].map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(member.id, status)}
                          disabled={submitted}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                            attendance[member.id] === status
                              ? status === 'present'
                                ? 'bg-green-500 text-white'
                                : status === 'absent'
                                ? 'bg-red-500 text-white'
                                : 'bg-yellow-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitted || loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded transition disabled:opacity-50"
        >
          {loading ? 'Submitting...' : submitted ? 'Already Submitted' : 'Submit Attendance'}
        </button>
      </div>
    </div>
  );
};

export default LeaderDashboard;
