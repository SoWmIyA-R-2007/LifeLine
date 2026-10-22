/**
 * Lifeline - Authentication Module
 * Handles Supabase Auth: signUp, signIn, signOut, and session guard
 * Seamlessly provides guest/demo fallback if Supabase is unconfigured
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient.js';

const DEMO_USER = {
  id: 'demo-user-001',
  email: 'alex.morgan@lifeline.app',
  user_metadata: {
    full_name: 'Alex Morgan',
    avatar_url: ''
  },
  isDemo: true
};

let authStateListeners = [];
let cachedSession = null;

export const Auth = {
  /**
   * Subscribe to auth state changes
   * @param {Function} callback - (event, session, user) => void
   * @returns {Function} unsubscribe function
   */
  onAuthStateChange(callback) {
    authStateListeners.push(callback);

    const client = getSupabase();
    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        cachedSession = session;
        callback(event, session, session ? session.user : null);
      });

      return () => {
        subscription.unsubscribe();
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
      };
    } else {
      // In Demo Mode, trigger immediately with simulated active user
      setTimeout(() => {
        callback('SIGNED_IN', { user: DEMO_USER }, DEMO_USER);
      }, 50);

      return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
      };
    }
  },

  /**
   * Get current session
   * @returns {Promise<Object|null>}
   */
  async getSession() {
    const client = getSupabase();
    if (!client) {
      return { user: DEMO_USER, isDemo: true };
    }
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('[Lifeline Auth] getSession error:', error);
      return null;
    }
    cachedSession = data.session;
    return data.session;
  },

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    const client = getSupabase();
    if (!client) {
      return DEMO_USER;
    }
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user;
  },

  /**
   * Sign up with email & password
   * @param {string} email
   * @param {string} password
   * @param {Object} [meta]
   */
  async signUp(email, password, meta = {}) {
    const client = getSupabase();
    if (!client) {
      // Demo simulated signup
      const user = {
        id: `demo-${Date.now()}`,
        email,
        user_metadata: { full_name: meta.full_name || email.split('@')[0] },
        isDemo: true
      };
      this._emitChange('SIGNED_IN', { user }, user);
      return { user, session: { user } };
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: meta
      }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email & password
   * @param {string} email
   * @param {string} password
   */
  async signIn(email, password) {
    const client = getSupabase();
    if (!client) {
      const user = {
        id: 'demo-user-001',
        email,
        user_metadata: { full_name: email.split('@')[0] },
        isDemo: true
      };
      this._emitChange('SIGNED_IN', { user }, user);
      return { user, session: { user } };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out
   */
  async signOut() {
    const client = getSupabase();
    if (!client) {
      this._emitChange('SIGNED_OUT', null, null);
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  /**
   * Check if current user is logged in or if demo mode is active
   */
  async isAuthenticated() {
    if (!isSupabaseConfigured()) return true; // Demo mode is always usable
    const session = await this.getSession();
    return !!session;
  },

  /**
   * Guard for protected actions
   * Throws or returns boolean indicating if action can proceed
   */
  async requireAuth() {
    const authed = await this.isAuthenticated();
    if (!authed) {
      throw new Error('Please sign in or create an account to perform this action.');
    }
    return true;
  },

  _emitChange(event, session, user) {
    cachedSession = session;
    authStateListeners.forEach(cb => {
      try {
        cb(event, session, user);
      } catch (err) {
        console.error('[Lifeline Auth Listener Error]', err);
      }
    });
  }
};
