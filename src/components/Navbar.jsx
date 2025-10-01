import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import "../styles/navbar.css";
import config from "../../config/config";

function Navbar({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const handleResetPassword = () => {
    navigate("/reset-password");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDoc = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const path = location.pathname;

  return (
    <header className="navbar">
      <div className="nav-left">
        <Link to="/page1" className="logo">
          <img src="/vite.svg" alt="logo" className="logo-img" />
          <span className="brand">{config.appTitle}</span>
        </Link>
      </div>

      <nav className="nav-links" aria-label="Main navigation">
        <NavLink to="/page1" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
          Add Linkedin Accounts
        </NavLink>
      </nav>

      <div className="nav-right">
        {session ? (
          <>
            <div className="user-name">
              {session.user?.user_metadata?.full_name || 
               session.user?.user_metadata?.name || 
               session.user?.email?.split('@')[0] || 
               "User"}
            </div>
            <button className="btn btn-ghost" onClick={handleSignOut}>
              Sign Out
            </button>
            <button onClick={handleResetPassword} className="btn btn-ghost">Reset Password</button>

          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost">Login</Link>
            <Link to="/sign-up" className="btn btn-primary">Sign Up</Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
