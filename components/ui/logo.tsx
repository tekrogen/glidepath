"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { box: "h-7 w-7", icon: "h-4 w-4", textSize: "text-lg" },
  md: { box: "h-8 w-8", icon: "h-5 w-5", textSize: "text-xl" },
  lg: { box: "h-10 w-10", icon: "h-6 w-6", textSize: "text-2xl" },
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const { box, icon, textSize } = sizeMap[size];

  return (
    <Link href="/" className={`flex items-center space-x-2 group ${className ?? ""}`}>
      <div
        className={`${box} gradient-brand rounded-lg flex items-center justify-center transition-transform group-hover:scale-105`}
      >
        <CreditCard className={`${icon} text-white`} />
      </div>
      {showText && (
        <span
          className={`${textSize} font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent`}
        >
          CardManager
        </span>
      )}
    </Link>
  );
}
