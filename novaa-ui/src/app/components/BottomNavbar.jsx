import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faUserFriends, faPlus, faInbox, fa7, faChartLine } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

function BottomNavbar({ className }) {
  return (
      <div className={className}>
        <div className="nav-item">
          <FontAwesomeIcon icon={faHouse} className="icon active" />
          <Link href="/" className="hover:text-gray-200 transition">
          <span className="item-name active">Home</span>
          </Link>        
        </div>
        <div className="nav-item">
          <FontAwesomeIcon icon={faUserFriends} className="icon" />
          <span className="item-name">Friends</span>
        </div>
        <div className="nav-item">
          <FontAwesomeIcon icon={faPlus} className="icon plus" />
          <span className="item-name">Create</span>
        </div>
        <div className="nav-item">
          <FontAwesomeIcon icon={fa7} className="notification" />
          <FontAwesomeIcon icon={faInbox} className="icon" />
          <span className="item-name">Inbox</span>
        </div>
        <div className="nav-item">
          <FontAwesomeIcon icon={faChartLine} className="icon" />
          <Link href="/dashboard" className="hover:text-gray-200 transition">
            <span className="item-name">Dashboard</span>
          </Link>
        </div>
      </div>
  );
}

export default BottomNavbar;
