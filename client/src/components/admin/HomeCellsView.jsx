import React from 'react';
import HomeCellModule from './HomeCellModule';

const HomeCellsView = ({ leaders = [], allMembers = [] }) => {
  return <HomeCellModule leaders={leaders} allMembers={allMembers} />;
};

export default HomeCellsView;
