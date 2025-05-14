import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTv, faSearch } from '@fortawesome/free-solid-svg-icons';

const TopNavbar = ({ className }) => {
  return (
    <div className={className}>
      <FontAwesomeIcon icon={faTv} className='icon'/>
      <h2>Following  |   <span>For You</span></h2>
      <FontAwesomeIcon icon={faSearch} className='icon'/>
    </div>
  );
};

export default TopNavbar;
