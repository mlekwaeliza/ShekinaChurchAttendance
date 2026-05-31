import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChevronRight, 
  Home, 
  Layers, 
  Users, 
  UserCog, 
  FileText, 
  Clock, 
  BarChart3, 
  Trophy, 
  Settings, 
  Shield,
  Activity,
  ClipboardList,
  Eye,
  LayoutDashboard
} from 'lucide-react';
import { useBreadcrumbs } from '../../context/BreadcrumbContext';

const Breadcrumbs = ({ userRole, userName }) => {
  const location = useLocation();
  const { extraBreadcrumbs } = useBreadcrumbs();

  const iconMap = {
    Layers,
    Users,
    UserCog,
    FileText,
    Clock,
    BarChart3,
    Trophy,
    Settings,
    Shield,
    Activity,
    ClipboardList,
    Eye,
    LayoutDashboard
  };

  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeConfigs = {
    admin: { label: 'Admin', icon: Shield },
    leader: { label: userRole === 'leader' && userName ? userName : 'Leader', icon: UserCog },
    pastor: { label: 'Pastor', icon: Activity },
    sections: { label: 'Sections', icon: Layers },
    members: { label: 'Members', icon: Users },
    leaders: { label: 'Leaders', icon: UserCog },
    reports: { label: 'Reports', icon: FileText },
    history: { label: 'History', icon: Clock },
    analytics: { label: 'Analytics', icon: BarChart3 },
    rewards: { label: 'Hall of Fame', icon: Trophy },
    settings: { label: 'Settings', icon: Settings },
    attendance: { label: 'Attendance', icon: ClipboardList },
    overview: { label: 'Overview', icon: Eye },
    'change-password': { label: 'Security', icon: Shield },
  };

  const breadcrumbs = pathnames.map((value, index) => {
    const last = index === pathnames.length - 1;
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    const config = routeConfigs[value] || { 
      label: value.charAt(0).toUpperCase() + value.slice(1), 
      icon: LayoutDashboard 
    };

    return { ...config, path: to, last };
  });

  const allCrumbs = [...breadcrumbs, ...extraBreadcrumbs];

  return (
    <nav className="flex items-center space-x-1 sm:space-x-2 text-[13px] font-medium" aria-label="Breadcrumb">
      <Link 
        to={userRole === 'admin' ? '/admin' : userRole === 'leader' ? '/leader' : '/pastor'}
        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-all duration-200"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {allCrumbs.map((crumb, index) => {
        const isLast = index === allCrumbs.length - 1;
        
        let Icon = crumb.icon;
        if (typeof Icon === 'string') {
          Icon = iconMap[Icon];
        }
        Icon = Icon || (isLast ? Eye : LayoutDashboard);

        return (
          <React.Fragment key={index}>
            <div className="flex items-center text-slate-300 dark:text-slate-600">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center group">
              {isLast ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold max-w-[120px] sm:max-w-[200px] md:max-w-xs animate-in fade-in slide-in-from-left-2 duration-300">
                  <Icon className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400 shrink-0" />
                  <span className="truncate">{crumb.label}</span>
                </div>
              ) : (
                <Link
                  to={crumb.path}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-primary-700 dark:hover:text-primary-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors shrink-0" />
                  <span className="truncate hidden sm:inline">{crumb.label}</span>
                </Link>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
