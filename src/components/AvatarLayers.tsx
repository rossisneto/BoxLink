import React from 'react';

export const AvatarLayers = {
  base: {
    male: (
      <g fill="currentColor">
        <circle cx="100" cy="50" r="35" /> {/* Head */}
        <path d="M100 90c-40 0-70 30-70 70v40h140v-40c0-40-30-70-70-70z" /> {/* Torso */}
        <path d="M60 200h30v80H60zM110 200h30v80h-30z" /> {/* Legs */}
      </g>
    ),
    female: (
      <g fill="currentColor">
        <circle cx="100" cy="50" r="35" /> {/* Head */}
        <path d="M100 90c-35 0-60 25-60 60v50h120v-50c0-35-25-60-60-60z" /> {/* Torso */}
        <path d="M70 200h25v80H70zM105 200h25v80h-25z" /> {/* Legs */}
      </g>
    )
  },
  top: {
    'top_1': (color: string) => (
      <path d="M100 90c-40 0-70 30-70 70v20h140v-20c0-40-30-70-70-70zM30 110l-20 40 20 10 10-30zM170 110l20 40-20 10-10-30z" fill={color} />
    ),
    'top_2': (color: string) => (
      <path d="M100 90c-30 0-50 20-50 50v40h100v-40c0-30-20-50-50-50z" fill={color} />
    ),
    'top_premium_1': (color: string) => (
      <g>
        <path d="M100 90c-40 0-70 30-70 70v20h140v-20c0-40-30-70-70-70zM30 110l-20 40 20 10 10-30zM170 110l20 40-20 10-10-30z" fill={color} />
        <path d="M110 120c-10 0-20 5-25 15 5-5 15-5 25-5z" fill="#FFFFFF" opacity="0.8" /> {/* Swoosh-like logo */}
      </g>
    ),
    'top_premium_2': (color: string) => (
      <g>
        <path d="M100 90c-30 0-50 20-50 50v40h100v-40c0-30-20-50-50-50z" fill={color} />
        <path d="M105 110c-5 0-10 3-12 8 3-3 8-3 12-3z" fill="#FFFFFF" opacity="0.8" /> {/* Small logo */}
      </g>
    )
  },
  bottom: {
    'bottom_1': (color: string) => (
      <path d="M60 190h80v40H60zM60 230h30v30H60zM110 230h30v30h-30z" fill={color} />
    ),
    'bottom_premium_1': (color: string) => (
      <g>
        <path d="M60 190h80v60H60zM60 250h35v30H60zM105 250h35v30h-35z" fill={color} />
        <path d="M70 210c-5 0-10 3-12 8 3-3 8-3 12-3z" fill="#FFFFFF" opacity="0.6" /> {/* Logo on leg */}
      </g>
    )
  },
  shoes: {
    'shoes_1': (color: string) => (
      <g fill={color}>
        <path d="M55 270h40v15H55zM105 270h40v15h-105z" />
      </g>
    ),
    'shoes_premium_1': (color: string) => (
      <g>
        <path d="M50 270h50v20H50zM100 270h50v20h-50z" fill={color} />
        <path d="M70 275c-5 0-10 3-12 8 3-3 8-3 12-3zM120 275c-5 0-10 3-12 8 3-3 8-3 12-3z" fill="#FFFFFF" opacity="0.8" />
      </g>
    )
  },
  accessory: {
    'acc_1': (color: string) => (
      <g fill={color}>
        <path d="M70 45h20v10H70zM110 45h20v10h-20zM90 50h20v2H90z" />
      </g>
    ),
    'belt_1': (color: string) => (
      <path d="M60 180h80v15H60zM90 180h20v15H90z" fill={color} stroke="#000" strokeWidth="1" />
    )
  },
  wrist_accessory: {
    'grips_1': (color: string) => (
      <g fill={color}>
        <path d="M35 160h15v20H35zM150 160h15v20h-15z" />
      </g>
    )
  },
  head_accessory: {
    'head_1': (color: string) => (
      <path d="M65 35a35 35 0 0 1 70 0v10H65zM135 45h30v5h-30z" fill={color} />
    ),
    'headband_1': (color: string) => (
      <path d="M65 40h70v10H65z" fill={color} />
    )
  },
  special: {
    'aura_1': (color: string) => (
      <g className="animate-pulse">
        <path d="M100 20 L120 50 L100 40 L80 50 Z" fill={color} opacity="0.6" />
        <path d="M40 150 L60 170 L40 160 Z" fill={color} opacity="0.4" />
        <path d="M160 150 L140 170 L160 160 Z" fill={color} opacity="0.4" />
      </g>
    )
  }
};
