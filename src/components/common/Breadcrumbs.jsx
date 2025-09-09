// src/components/common/Breadcrumbs.jsx
'use client'

import Link from 'next/link'

export default function Breadcrumbs({ items }) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <nav className="flex mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <svg 
                className="w-3 h-3 text-gray-400 mx-1" 
                aria-hidden="true" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 6 10"
              >
                <path 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="m1 9 4-4-4-4"
                />
              </svg>
            )}
            {item.href ? (
              <Link 
                href={item.href}
                className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600"
              >
                {item.icon && (
                  <item.icon className="w-4 h-4 mr-2" />
                )}
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex items-center text-sm font-medium text-gray-500">
                {item.icon && (
                  <item.icon className="w-4 h-4 mr-2" />
                )}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}