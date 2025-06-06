import React from 'react';

export const Footer = () => {
  return (
    <footer className="border-t py-6 md:py-8">
      <div className="container text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Weby Awesome App. All rights reserved.</p>
      </div>
    </footer>
  );
};