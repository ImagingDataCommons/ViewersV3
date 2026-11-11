import React from 'react';
import type { IconProps } from '../types';

/**
 * Toolbar icon for the mode selector: two workflow blocks joined by an
 * arrow, so it does not read as the list-like DICOM tag browser icon.
 */
export const ModeSwitch = (props: IconProps) => (
  <svg
    width="28px"
    height="28px"
    viewBox="0 0 28 28"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g
      id="icon-mode-switch"
      stroke="none"
      strokeWidth="1"
      fill="none"
      fillRule="evenodd"
    >
      <rect
        id="Rectangle"
        x="0"
        y="0"
        width="28"
        height="28"
      ></rect>
      <g
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          x="5"
          y="5"
          width="8"
          height="8"
          rx="2"
        ></rect>
        <rect
          x="15"
          y="15"
          width="8"
          height="8"
          rx="2"
        ></rect>
        <path d="M9,13 L9,17 C9,18.1045695 9.8954305,19 11,19 L14,19"></path>
        <polyline points="12 17 14 19 12 21"></polyline>
      </g>
    </g>
  </svg>
);

export default ModeSwitch;
