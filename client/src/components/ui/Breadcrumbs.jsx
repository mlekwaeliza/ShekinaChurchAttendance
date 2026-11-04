import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useBreadcrumbs } from '../../context/BreadcrumbContext';

// Apple nav bars carry one line of text, not a stack of chips. The path is
// rendered as plain label → chevron → label, with the current page in the
// primary label color and ancestors in the secondary label color.
const Breadcrumbs = ({ userRole, userName }) => {
  const location = useLocation();
  const { extraBreadcrumbs } = useBreadcrumbs();

  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeConfigs = {
    admin: { label: 'Admin' },
    leader: { label: userRole === 'leader' && userName ? userName : 'Leader' },
    pastor: { label: 'Pastor' },
    sections: { label: 'Sections' },
    members: { label: 'Members' },
    leaders: { label: 'Leaders' },
    reports: { label: 'Reports' },
    history: { label: 'History' },
    analytics: { label: 'Analytics' },
    rewards: { label: 'Recognition' },
    settings: { label: 'Settings' },
    attendance: { label: 'Attendance' },
    overview: { label: 'Overview' },
    'change-password': { label: 'Security' }
  };

  const breadcrumbs = pathnames.map((value, index) => {
    const last = index === pathnames.length - 1;
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    const config = routeConfigs[value] || {
      label: value.charAt(0).toUpperCase() + value.slice(1)
    };

    return { ...config, path: to, last };
  });

  const allCrumbs = [...breadcrumbs, ...extraBreadcrumbs];
  const homePath = userRole === 'admin' ? '/admin' : userRole === 'leader' ? '/leader' : '/pastor';

  return (
    <nav className="flex min-w-0 items-center gap-1 text-footnote" aria-label="Breadcrumb">
      <Link
        to={homePath}
        className="rounded-md p-1 text-secondary-label transition-colors hover:text-label"
        aria-label="Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {allCrumbs.map((crumb, index) => {
        const isLast = index === allCrumbs.length - 1;

        return (
          <React.Fragment key={index}>
            <ChevronRight className="h-3 w-3 shrink-0 text-tertiary-label" aria-hidden="true" />

            {isLast ? (
              <span className="truncate font-semibold text-label" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="truncate text-secondary-label transition-colors hover:text-label"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
