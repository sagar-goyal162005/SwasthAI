import type { SVGProps } from 'react';

export const Icons = {
  logo: (props: SVGProps<SVGSVGElement>) => (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
    >
      <defs>
        <linearGradient id="swasthaiBrand" x1="40" y1="216" x2="216" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="0.5" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
      </defs>

      {/* Hex / shield outline */}
      <path
        d="M128 24 L206 68 V156 L128 200 L50 156 V68 L128 24 Z"
        stroke="url(#swasthaiBrand)"
        strokeWidth="18"
        strokeLinejoin="round"
      />

      {/* Inner heart mark */}
      <path
        d="M128 172
           C104 156 76 134 76 104
           C76 82 92 66 112 66
           C120 66 126 69 128 74
           C130 69 136 66 144 66
           C164 66 180 82 180 104
           C180 134 152 156 128 172 Z"
        stroke="url(#swasthaiBrand)"
        strokeWidth="18"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  points: (props: SVGProps<SVGSVGElement>) => (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  streak: (props: SVGProps<SVGSVGElement>) => (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
};
