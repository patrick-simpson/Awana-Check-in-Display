import React from 'react';

export const BrandBar = ({ height = 4 }) => (
  <div
    className="brand-bar-animated flex-shrink-0 w-full"
    style={{ height: `${height}px` }}
  />
);
