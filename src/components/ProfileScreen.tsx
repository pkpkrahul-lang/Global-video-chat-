/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User as UserIcon, Globe, Check, MessageSquare, ShieldAlert } from 'lucide-react';
import { User } from '../types';

interface ProfileScreenProps {
  user: User;
  onUpdateProfile: (updated: Partial<User>) => Promise<void>;
}

const AVATAR_OPTIONS = ['🦊', '🐱', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦖', '🦄', '👽', '🤖', '👑', '⭐️', '🎯', '🚀'];
const COUNTRIES = [
  'United States 🇺🇸', 'Canada 🇨🇦', 'United Kingdom 🇬🇧', 'France 🇫🇷', 'Germany 🇩🇪', 
  'Japan 🇯🇵', 'Brazil 🇧🇷', 'Mexico 🇲🇽', 'Italy 🇮🇹', 'Spain 🇪🇸', 'South Korea 🇰🇷', 'Australia 🇦🇺'
];
const LANGUAGES = ['English', 'Spanish', 'French', 'Japanese', 'Portuguese', 'Italian', 'German', 'Korean', 'Mandarin'];

export default function ProfileScreen({ user, onUpdateProfile }: ProfileScreenProps) {
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState(user.avatar);
  const [gender, setGender] = useState<User['gender']>(user.gender);
  const [country, setCountry] = useState(user.country);
  const [language, setLanguage] = useState(user.language);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await onUpdateProfile({
        username,
        avatar,
        gender,
        country,
        language
      });
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div id="profile-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-2xl h-full">
      <div className="flex items-center gap-2 mb-5">
        <UserIcon className="text-amber-400 w-5 h-5" />
        <h2 className="font-display font-semibold text-lg text-slate-100">Identity Desk</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Select Grid */}
        <div>
          <label className="text-xs uppercase font-semibold font-mono text-slate-400 tracking-wider block mb-1.5">Select Avatar Persona</label>
          <div className="grid grid-cols-8 gap-1.5 max-h-[140px] overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-850">
            {AVATAR_OPTIONS.map((av) => (
              <button
                key={av}
                type="button"
                onClick={() => setAvatar(av)}
                className={`text-xl p-2 rounded-lg transition hover:scale-115 active:scale-95 flex items-center justify-center cursor-pointer ${
                  avatar === av ? 'bg-amber-400/10 border border-amber-400' : 'bg-slate-900 border border-transparent'
                }`}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="text-xs uppercase font-semibold font-mono text-slate-400 tracking-wider block mb-1">Username / Nickname</label>
          <input
            type="text"
            required
            maxLength={18}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-slate-100 outline-none focus:border-slate-700 font-medium"
            placeholder="Alex Explorer"
          />
        </div>

        {/* Gender / Matching Identity */}
        <div>
          <label className="text-xs uppercase font-semibold font-mono text-slate-400 tracking-wider block mb-1.5">Gender Selection</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'male', label: 'Male ♂' },
              { id: 'female', label: 'Female ♀' },
              { id: 'unspecified', label: 'Secret 🔒' }
            ].map((gen) => (
              <button
                key={gen.id}
                type="button"
                onClick={() => setGender(gen.id as User['gender'])}
                className={`py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  gender === gen.id
                    ? 'bg-amber-400/5 border-amber-400 text-amber-400'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                }`}
              >
                {gen.label}
              </button>
            ))}
          </div>
        </div>

        {/* Country and Fluency */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="text-xs uppercase font-semibold font-mono text-slate-400 tracking-wider block mb-1">From Region</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-slate-300 outline-none focus:border-slate-700 font-sans cursor-pointer"
            >
              <option value="Global Area">Global Area 🌐</option>
              {COUNTRIES.map((cnt) => (
                <option key={cnt} value={cnt}>{cnt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase font-semibold font-mono text-slate-400 tracking-wider block mb-1">Primary Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-slate-300 outline-none focus:border-slate-700 font-sans cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trust disclaimer */}
        <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-850 flex gap-2 items-start mt-4">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-normal font-sans">
            Your verification criteria is encrypted at server node. We protect user privacy. Premium matchers verify identity matching standards.
          </p>
        </div>

        {/* Submit */}
        <div className="pt-2">
          {saveSuccess ? (
            <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs py-2 rounded-xl text-center flex items-center justify-center gap-2 font-medium">
              <Check className="w-4 h-4" /> Identity Verified and Synchronized!
            </div>
          ) : (
            <button
              type="submit"
              disabled={saving}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold tracking-wide cursor-pointer transition flex items-center justify-center gap-1 bg-amber-400 hover:bg-amber-500 text-slate-950 ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Saving...' : 'Sync Identity'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
