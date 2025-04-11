import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export default function ToggleSwitch({ checked, onChange, disabled = false, className }: ToggleSwitchProps) {
  // Use internal state to ensure smooth transitions and prevent flickering
  const [internalState, setInternalState] = useState(checked);
  
  // Sync internal state with external checked prop
  useEffect(() => {
    setInternalState(checked);
  }, [checked]);
  
  // Handler for the change event
  const handleChange = (newState: boolean) => {
    if (disabled) return;
    
    // Update internal state immediately for visual feedback
    setInternalState(newState);
    
    // Call the parent's onChange handler
    onChange(newState);
  };
  
  return (
    <label 
      className={cn(
        "relative inline-block w-[64px] h-[34px]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        type="checkbox"
        className="opacity-0 w-0 h-0"
        checked={internalState}
        onChange={(e) => handleChange(e.target.checked)}
        disabled={disabled}
        aria-label={internalState ? "Disconnect VPN" : "Connect VPN"}
      />
      <span
        className={cn(
          "absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300",
          internalState 
            ? "bg-gradient-to-r from-blue-600 to-cyan-400 shadow-lg shadow-blue-500/30" 
            : "bg-gray-800 border border-gray-700",
          disabled && "cursor-not-allowed"
        )}
      >
        {/* Track lines for futuristic look */}
        <span className={cn(
          "absolute inset-[3px] rounded-full overflow-hidden",
          internalState ? "opacity-30" : "opacity-0",
          "transition-opacity duration-300"
        )}>
          <span className="absolute inset-0 bg-grid-pattern bg-black/20"></span>
        </span>
        
        {/* Glowing dot when active */}
        {internalState && (
          <span className="absolute h-[4px] w-[4px] right-[14px] top-1/2 -translate-y-1/2 bg-white rounded-full animate-pulse"></span>
        )}
        
        {/* Processing indicator when disabled */}
        {disabled && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 border-2 border-t-transparent border-blue-300 rounded-full animate-spin"></span>
          </span>
        )}
        
        {/* Knob with futuristic styling */}
        <span 
          className={cn(
            "absolute h-[26px] w-[26px] left-[4px] bottom-[4px] rounded-full transition-all duration-300 flex items-center justify-center",
            internalState 
              ? "transform translate-x-[30px] bg-white shadow-md shadow-blue-500/20" 
              : "bg-gray-200",
          )}
        >
          {/* Center dot */}
          <span className={cn(
            "h-[10px] w-[10px] rounded-full transition-colors duration-300",
            internalState ? "bg-blue-500" : "bg-gray-400"
          )}></span>
        </span>
      </span>
    </label>
  );
}
