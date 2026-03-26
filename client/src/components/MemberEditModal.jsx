import React, { useState, useEffect } from 'react';

const MemberEditModal = ({ member, sections, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    age_group: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        full_name: member.full_name || '',
        phone: member.phone || '',
        email: member.email || '',
        gender: member.gender || '',
        age_group: member.age_group || ''
      });
    }
  }, [member]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(member.id, formData);
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Edit Member</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Membership ID</label>
            <input
              type="text"
              value={member.membership_id}
              disabled
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Membership ID cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age Group</label>
            <select
              name="age_group"
              value={formData.age_group}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Age Group</option>
              <option value="Child">Child (0-12)</option>
              <option value="Teen">Teen (13-19)</option>
              <option value="Young Adult">Young Adult (20-35)</option>
              <option value="Adult">Adult (36-64)</option>
              <option value="Senior">Senior (65+)</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberEditModal;
