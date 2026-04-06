import React from 'react';
import { AvatarSlot } from '../types';
import { cn } from '../lib/utils';

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function AvatarPreview({ equipped, className, size = 'md' }: AvatarPreviewProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-24 h-24 text-4xl',
    lg: 'w-32 h-32 text-5xl',
    xl: 'w-48 h-48 text-7xl',
  };

  // In a real app, these would be layered images or SVGs.
  // For this demo, we'll use emojis and layered divs to represent the avatar.
  
  return (
    <div className={cn(
      "relative rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]",
      sizeClasses[size],
      className
    )}>
      {/* Base Body */}
      <span className="z-0">👤</span>

      {/* Layered Items (Simplified representation) */}
      {equipped.head_accessory && (
        <div className="absolute top-0 left-0 w-full h-full flex items-start justify-center pt-[10%] z-10 animate-bounce-slow">
          <span className="text-[0.4em]">🧢</span>
        </div>
      )}
      
      {equipped.top && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pt-[20%] z-5">
          <span className="text-[0.5em]">👕</span>
        </div>
      )}

      {equipped.accessory && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
          <span className="text-[0.3em] ml-[40%] mt-[10%]">🕶️</span>
        </div>
      )}

      {equipped.wrist_accessory && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-15">
          <span className="text-[0.2em] ml-[35%] mt-[35%]">⌚</span>
        </div>
      )}

      {equipped.bottom && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pt-[60%] z-4">
          <span className="text-[0.5em]">🩳</span>
        </div>
      )}

      {equipped.shoes && (
        <div className="absolute top-0 left-0 w-full h-full flex items-end justify-center pb-[10%] z-3">
          <span className="text-[0.4em]">👟</span>
        </div>
      )}

      {equipped.special && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-0 opacity-50 animate-pulse">
          <span className="text-[0.8em]">✨</span>
        </div>
      )}
    </div>
  );
}
