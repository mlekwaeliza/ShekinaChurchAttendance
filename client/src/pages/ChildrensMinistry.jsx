import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { Baby, Users, GraduationCap, Calendar, TrendingUp, AlertTriangle, Plus, Search, Heart, Stethoscope } from 'lucide-react';

const AGE_GROUPS = ['Infant (0-2)', 'Toddler (3-4)', 'Children (5-8)', 'Pre-Teen (9-12)', 'Teen (13-15)'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'excused', 'late'];

export default function ChildrensMinistry() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ classes: [], teachers: [], children: [], promotions: [], dashboard: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [showModal, setShowModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const { showToast } = useToast();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'children', label: 'Children', icon: Baby },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'promotions', label: 'Promotions', icon: TrendingUp },
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [classes, teachers, children, promotions, dashboard] = await Promise.all([
        adminAPI.children.getClasses(),
        adminAPI.children.getTeachers(),
        adminAPI.children.getChildren(),
        adminAPI.children.getPromotions(),
        adminAPI.children.getDashboard(),
      ]);
      setData({ classes, teachers, children, promotions, dashboard });
    } catch (error) {
      console.error('Failed to load children ministry data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (showModal === 'class') {
        if (formData.id) {
          await adminAPI.children.updateClass(formData.id, formData);
          showToast('Class updated', 'success');
        } else {
          await adminAPI.children.createClass(formData);
          showToast('Class created', 'success');
        }
      } else if (showModal === 'teacher') {
        if (formData.id) {
          await adminAPI.children.updateTeacher(formData.id, formData);
          showToast('Teacher updated', 'success');
        } else {
          await adminAPI.children.createTeacher(formData);
          showToast('Teacher created', 'success');
        }
      } else if (showModal === 'child') {
        if (formData.id) {
          await adminAPI.children.updateChild(formData.id, formData);
          showToast('Child updated', 'success');
        } else {
          await adminAPI.children.createChild(formData);
          showToast('Child registered', 'success');
        }
      } else if (showModal === 'promotion') {
        await adminAPI.children.createPromotion(formData);
        showToast('Promotion recorded', 'success');
      } else if (showModal === 'bulkAttendance') {
        const records = Object.entries(attendanceRecords).map(([childId, status]) => ({
          child_id: parseInt(childId), status
        }));
        await adminAPI.children.bulkAttendance({ class_id: selectedClass, date: attendanceDate, records });
        showToast('Attendance saved', 'success');
      }
      setShowModal(null);
      setFormData({});
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to save', 'error');
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Are you sure?')) return;
    try {
      if (type === 'class') await adminAPI.children.deleteClass(id);
      else if (type === 'teacher') await adminAPI.children.deleteTeacher(id);
      else if (type === 'child') await adminAPI.children.deleteChild(id);
      showToast('Deleted successfully', 'success');
      loadData();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  const filteredChildren = data.children.filter(c =>
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.parent_guardian_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const medicalAlerts = data.children.filter(c => c.medical_notes || c.allergies);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Children's Ministry</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage classes, teachers, and children</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'classes' && (
            <button onClick={() => { setFormData({}); setShowModal('class'); }}
              className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Class
            </button>
          )}
          {activeTab === 'teachers' && (
            <button onClick={() => { setFormData({}); setShowModal('teacher'); }}
              className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Teacher
            </button>
          )}
          {activeTab === 'children' && (
            <button onClick={() => { setFormData({}); setShowModal('child'); }}
              className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Register Child
            </button>
          )}
          {activeTab === 'attendance' && selectedClass && (
            <button onClick={() => setShowModal('bulkAttendance')}
              className="btn-primary flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Record Attendance
            </button>
          )}
        </div>
      </div>

      <div className="tab-pills">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setSearchParams({ tab: tab.id })}
            className={`tab-pill flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl"><Baby className="w-6 h-6 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.dashboard.totalChildren || 0}</p>
                <p className="text-sm text-slate-500">Total Children</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl"><GraduationCap className="w-6 h-6 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.dashboard.totalClasses || 0}</p>
                <p className="text-sm text-slate-500">Active Classes</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl"><Users className="w-6 h-6 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.dashboard.totalTeachers || 0}</p>
                <p className="text-sm text-slate-500">Active Teachers</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl"><Calendar className="w-6 h-6 text-orange-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.dashboard.todayAttendance || 0}</p>
                <p className="text-sm text-slate-500">Today's Attendance</p>
              </div>
            </div>
          </div>

          {medicalAlerts.length > 0 && (
            <div className="card p-4 md:col-span-2 lg:col-span-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Medical Alerts</h3>
              </div>
              <div className="space-y-2">
                {medicalAlerts.map(child => (
                  <div key={child.id} className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <Stethoscope className="w-4 h-4 text-amber-600" />
                    <span className="font-medium">{child.full_name}</span>
                    {child.allergies && <Badge variant="warning">Allergies: {child.allergies}</Badge>}
                    {child.medical_notes && <Badge variant="info">{child.medical_notes}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.dashboard.recentPromotions?.length > 0 && (
            <div className="card p-4 md:col-span-2 lg:col-span-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Recent Promotions</h3>
              <div className="space-y-2">
                {data.dashboard.recentPromotions.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{p.child_name}</span>
                    <span className="text-slate-500">promoted to</span>
                    <Badge variant="success">{p.new_class}</Badge>
                    <span className="text-sm text-slate-400 ml-auto">{new Date(p.promotion_date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.classes.map(cls => (
            <div key={cls.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{cls.name}</h3>
                  {cls.age_group && <p className="text-sm text-slate-500">{cls.age_group}</p>}
                </div>
                <Badge variant="info">{cls.enrolled_count || 0} children</Badge>
              </div>
              {cls.description && <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{cls.description}</p>}
              <div className="flex gap-2 text-sm text-slate-500 mb-3">
                {cls.room_number && <span>Room: {cls.room_number}</span>}
                {cls.schedule && <span>Schedule: {cls.schedule}</span>}
              </div>
              {cls.teacher_name && (
                <p className="text-sm text-slate-500"><Users className="w-4 h-4 inline mr-1" />{cls.teacher_name}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setFormData(cls); setShowModal('class'); }}
                  className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                <button onClick={() => handleDelete('class', cls.id)}
                  className="btn-danger text-xs px-3 py-1.5">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teachers Tab */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {data.teachers.map(teacher => (
            <div key={teacher.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{teacher.full_name}</h3>
                    <p className="text-sm text-slate-500">{teacher.phone || teacher.email || 'No contact info'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {teacher.background_check ? (
                    <Badge variant="success">Background Checked</Badge>
                  ) : (
                    <Badge variant="warning">Pending Check</Badge>
                  )}
                  {teacher.assigned_classes && (
                    <Badge variant="info">{teacher.assigned_classes}</Badge>
                  )}
                  <button onClick={() => { setFormData(teacher); setShowModal('teacher'); }}
                    className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                  <button onClick={() => handleDelete('teacher', teacher.id)}
                    className="btn-danger text-xs px-3 py-1.5">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Children Tab */}
      {activeTab === 'children' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search children or parents..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
            </div>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
              <option value="">All Classes</option>
              {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {filteredChildren.filter(c => !selectedClass || c.class_id == selectedClass).map(child => (
              <div key={child.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Baby className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{child.full_name}</h3>
                      <p className="text-sm text-slate-500">
                        {child.age_group} | Parent: {child.parent_guardian_name || 'N/A'}
                        {child.parent_guardian_phone && ` | ${child.parent_guardian_phone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {child.class_name && <Badge variant="info">{child.class_name}</Badge>}
                    {(child.medical_notes || child.allergies) && (
                      <Badge variant="warning"><Heart className="w-3 h-3 mr-1 inline" />Medical</Badge>
                    )}
                    <button onClick={() => { setFormData(child); setShowModal('child'); }}
                      className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                    <button onClick={() => handleDelete('child', child.id)}
                      className="btn-danger text-xs px-3 py-1.5">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
              <option value="">Select Class</option>
              {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
            <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
          </div>

          {selectedClass && (
            <div className="card p-4">
              <h3 className="font-semibold mb-4">Mark Attendance for {new Date(attendanceDate).toLocaleDateString()}</h3>
              <div className="space-y-2">
                {data.children.filter(c => c.class_id == selectedClass).map(child => (
                  <div key={child.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="font-medium">{child.full_name}</span>
                    <div className="flex gap-2">
                      {ATTENDANCE_STATUSES.map(status => (
                        <button key={status} onClick={() => setAttendanceRecords(prev => ({ ...prev, [child.id]: status }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            attendanceRecords[child.id] === status
                              ? status === 'present' ? 'bg-green-500 text-white'
                              : status === 'absent' ? 'bg-red-500 text-white'
                              : status === 'excused' ? 'bg-yellow-500 text-white'
                              : 'bg-orange-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Promotions Tab */}
      {activeTab === 'promotions' && (
        <div className="space-y-4">
          <button onClick={() => { setFormData({ promotion_date: new Date().toISOString().split('T')[0] }); setShowModal('promotion'); }}
            className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Record Promotion
          </button>
          <div className="space-y-2">
            {data.promotions.map(promo => (
              <div key={promo.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <div>
                    <span className="font-medium">{promo.child_name}</span>
                    <span className="text-slate-500 mx-2">promoted from</span>
                    <Badge variant="outline">{promo.from_class_name || 'N/A'}</Badge>
                    <span className="text-slate-500 mx-2">to</span>
                    <Badge variant="success">{promo.to_class_name}</Badge>
                  </div>
                  <span className="text-sm text-slate-400 ml-auto">{new Date(promo.promotion_date).toLocaleDateString()}</span>
                </div>
                {promo.notes && <p className="text-sm text-slate-500 mt-2 ml-8">{promo.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <Modal onClose={() => setShowModal(null)} title={
          showModal === 'class' ? (formData.id ? 'Edit Class' : 'Add Class') :
          showModal === 'teacher' ? (formData.id ? 'Edit Teacher' : 'Add Teacher') :
          showModal === 'child' ? (formData.id ? 'Edit Child' : 'Register Child') :
          showModal === 'promotion' ? 'Record Promotion' : 'Record Attendance'
        }>
          <div className="space-y-4">
            {(showModal === 'class') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Class Name *</label>
                  <input type="text" value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Age Group</label>
                  <select value={formData.age_group || ''} onChange={e => setFormData(p => ({ ...p, age_group: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Select Age Group</option>
                    {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <input type="text" value={formData.description || ''} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Capacity</label>
                  <input type="number" value={formData.max_capacity || ''} onChange={e => setFormData(p => ({ ...p, max_capacity: parseInt(e.target.value) || null }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room Number</label>
                  <input type="text" value={formData.room_number || ''} onChange={e => setFormData(p => ({ ...p, room_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Schedule</label>
                  <input type="text" value={formData.schedule || ''} onChange={e => setFormData(p => ({ ...p, schedule: e.target.value }))}
                    placeholder="e.g., Sunday 9:00 AM"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
              </>
            )}
            {(showModal === 'teacher') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input type="text" value={formData.full_name || ''} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input type="text" value={formData.phone || ''} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qualification</label>
                  <input type="text" value={formData.qualification || ''} onChange={e => setFormData(p => ({ ...p, qualification: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.background_check || false} onChange={e => setFormData(p => ({ ...p, background_check: e.target.checked }))} />
                  <span className="text-sm">Background Check Completed</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign Classes</label>
                  <select multiple value={formData.class_ids || []} onChange={e => setFormData(p => ({ ...p, class_ids: Array.from(e.target.selectedOptions, o => parseInt(o.value)) }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {(showModal === 'child') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Child's Full Name *</label>
                  <input type="text" value={formData.full_name || ''} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                  <input type="date" value={formData.date_of_birth || ''} onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select value={formData.gender || ''} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parent/Guardian Name</label>
                  <input type="text" value={formData.parent_guardian_name || ''} onChange={e => setFormData(p => ({ ...p, parent_guardian_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parent Phone</label>
                  <input type="text" value={formData.parent_guardian_phone || ''} onChange={e => setFormData(p => ({ ...p, parent_guardian_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parent Email</label>
                  <input type="email" value={formData.parent_guardian_email || ''} onChange={e => setFormData(p => ({ ...p, parent_guardian_email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Emergency Contact</label>
                  <input type="text" value={formData.emergency_contact || ''} onChange={e => setFormData(p => ({ ...p, emergency_contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Emergency Phone</label>
                  <input type="text" value={formData.emergency_phone || ''} onChange={e => setFormData(p => ({ ...p, emergency_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Class</label>
                  <select value={formData.class_id || ''} onChange={e => setFormData(p => ({ ...p, class_id: parseInt(e.target.value) || null }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Select Class</option>
                    {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Age Group</label>
                  <select value={formData.age_group || ''} onChange={e => setFormData(p => ({ ...p, age_group: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Select Age Group</option>
                    {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Medical Notes</label>
                  <input type="text" value={formData.medical_notes || ''} onChange={e => setFormData(p => ({ ...p, medical_notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allergies</label>
                  <input type="text" value={formData.allergies || ''} onChange={e => setFormData(p => ({ ...p, allergies: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.photo_consent || false} onChange={e => setFormData(p => ({ ...p, photo_consent: e.target.checked }))} />
                  <span className="text-sm">Photo Consent Given</span>
                </label>
              </>
            )}
            {showModal === 'promotion' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Child</label>
                  <select value={formData.child_id || ''} onChange={e => setFormData(p => ({ ...p, child_id: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Select Child</option>
                    {data.children.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.class_name || 'No Class'})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Class</label>
                  <select value={formData.from_class_id || ''} onChange={e => setFormData(p => ({ ...p, from_class_id: parseInt(e.target.value) || null }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Current Class</option>
                    {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To Class *</label>
                  <select value={formData.to_class_id || ''} onChange={e => setFormData(p => ({ ...p, to_class_id: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm">
                    <option value="">Select New Class</option>
                    {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Promotion Date *</label>
                  <input type="date" value={formData.promotion_date || ''} onChange={e => setFormData(p => ({ ...p, promotion_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <input type="text" value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm" />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setShowModal(null)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSave} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
