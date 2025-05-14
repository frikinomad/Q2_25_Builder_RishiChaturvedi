import React from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMusic } from '@fortawesome/free-solid-svg-icons';
import './FooterLeft.css';
import Link from 'next/link';
import { Sparkles } from "lucide-react";


export default function FooterLeft(props) {
  const { username, description, song } = props;

  const router = useRouter();

  const handleStakeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    router.push('/dashboard');
  };

  return (
    <div className="footer-container">
      <div className="w-full relative z-10"> {/* Added relative positioning and z-index to ensure clickability */}
        <Link
          href="/dashboard"
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white text-center 
          bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 shadow-[0_0_45px_10px_rgba(255,46,88,0.8)] 
          hover:shadow-[0_0_60px_15px_rgba(255,46,88,1)] transition-shadow duration-300 flex items-center justify-center gap-2"
          style={{ pointerEvents: 'auto' }} /* Ensure pointer events are not blocked */
        >
          <Sparkles className="h-4 w-4" />
          Stake & Become more than just a fan
        </Link>
      </div>

      <div className="footer-left">
        <div className="text">
          <h3>@{username}</h3>
          <p>{description}</p>
          <div className="ticker">
            <FontAwesomeIcon icon={faMusic} style={{ width: '30px' }} />
            {/* eslint-disable-next-line jsx-a11y/no-distracting-elements */}
            <marquee direction="left" scrollamount="2">
              <span>{song}</span>
            </marquee>
          </div>
        </div>
      </div>
      <div className="w-full relative z-10">
        <Link
          href="/initialize_dao"
          className="w-full px-3 py-1.5 rounded-md text-xs font-medium text-white text-center 
          bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 
          shadow-[0_0_20px_4px_rgba(251,191,36,0.4)] 
          hover:shadow-[0_0_30px_6px_rgba(251,191,36,0.6)] 
          transition-shadow duration-300 flex items-center justify-center gap-1.5"
          style={{ pointerEvents: 'auto' }}
        >
          <Sparkles className="h-3 w-3" />
          Launch your DAO
        </Link>
      </div>
    </div>
  );
}
