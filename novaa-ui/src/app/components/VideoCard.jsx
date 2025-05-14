import React, { useRef, useEffect } from 'react';
import FooterLeft from './FooterLeft';
import FooterRight from './FooterRight';
import './VideoCard.css';

const VideoCard = (props) => {
  const { url, username, description, song, likes, shares, comments, saves, profilePic, setVideoRef, autoplay } = props;
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (autoplay) {
      videoRef.current.play();
    }
  }, [autoplay]);


  // Keep track of whether the video is being controlled
  const isControllingVideo = useRef(false);

  const onVideoPress = (e) => {
    // Don't toggle video play state if we're clicking on a control or button
    if (isControllingVideo.current) {
      isControllingVideo.current = false;
      return;
    }

    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const onControlsClick = (e) => {
    isControllingVideo.current = true;
  };

  return (
    <div className="video">
      {/* The video element */}
      <video
        className="player"
        onClick={onVideoPress}
        ref={(ref) => {
          videoRef.current = ref;
          setVideoRef(ref);
        }}
        loop
        src={url}
      ></video>
      <div className="bottom-controls" onClick={onControlsClick}>
        <div className="footer-left">
          {/* The left part of the container */}
          <FooterLeft username={username} description={description} song={song} />
        </div>
        <div className="footer-right">
          {/* The right part of the container */}
          <FooterRight likes={likes} shares={shares} comments={comments} saves={saves} profilePic={profilePic} />
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
