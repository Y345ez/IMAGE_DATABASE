"use client";

import React, { useState, useEffect, ReactNode } from "react";
import { toast } from "react-hot-toast";

interface PasswordCheckProps {
  children: ReactNode;
}

const PasswordCheck: React.FC<PasswordCheckProps> = ({ children }) => {
  const [password, setPassword] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const getCookie = (name: string): string | undefined => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };

  const setCookie = (name: string, value: string, days: number): void => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/;`;
  };


  useEffect(() => {
    const storedAuthStatus = getCookie("isAuthenticated");
    if (storedAuthStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_PASSWORD; 

    if (correctPassword && password === correctPassword) {
      setIsAuthenticated(true);
      setCookie("isAuthenticated", "true", 7);
      toast.success("Password correct! Access granted.");
    } else {
      toast.error("ليش انت هو ؟ 🤨");
    }
  };


  if (!isAuthenticated) {
    return (
    <div className="password-check flex justify-center items-center min-h-screen ">
      <form
        onSubmit={handlePasswordSubmit}
        className="flex flex-col gap-4 border-solid border-2 border-[#EBF8FF1A] p-6 backdrop-blur shadow-md rounded-md w-full max-w-sm"
      >
    <span className="text-[#79c0a2] overflow-hidden whitespace-nowrap text-ellipsis w-full">Password to enter</span>
        <input
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Enter password"
          required
          className="px-4 py-2 border border-[#EBF8FF1A] rounded-md focus:outline-none backdrop-blur bg-white/5"
        />
        <button
          type="submit"
          className="px-4 py-2 border-solid border-2 border-[#EBF8FF1A] text-[#79c0a2] rounded-md bg-white/5 backdrop-blur transition-colors"
        >
          Submit
        </button>
      </form>
    </div>
    );
  }

  return <>{children}</>;
};

export default PasswordCheck;
