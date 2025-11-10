{\rtf1\ansi\ansicpg1252\cocoartf2761
\cocoatextscaling1\cocoaplatform1{\fonttbl\f0\fnil\fcharset0 .AppleSystemUIFontMonospaced-Regular;}
{\colortbl;\red255\green255\blue255;\red198\green120\blue221;\red171\green178\blue191;\red152\green195\blue121;
}
{\*\expandedcolortbl;;\cssrgb\c77647\c47059\c86667;\cssrgb\c67059\c69804\c74902;\cssrgb\c59608\c76471\c47451;
}
\pard\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0

\f0\fs26 \cf2 const\cf3  CACHE_NAME = \cf4 'mssu-cache-v1'\cf3 ;\
\cf2 const\cf3  FILES_TO_CACHE = [\
  \cf4 '/'\cf3 ,\
  \cf4 '/index.html'\cf3 ,\
  \cf4 '/admin.html'\cf3 ,\
  \cf4 '/style.css'\cf3 ,\
  \cf4 '/script.js'\cf3 ,\
  \cf4 '/manifest.json'\cf3 \
];\
\
self.addEventListener(\cf4 'install'\cf3 , e => \{\
  self.skipWaiting();\
  e.waitUntil(\
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))\
  );\
\});\
\
self.addEventListener(\cf4 'activate'\cf3 , e => \{\
  e.waitUntil(self.clients.claim());\
\});\
\
self.addEventListener(\cf4 'fetch'\cf3 , e => \{\
  e.respondWith(\
    caches.match(e.request).then(resp => resp || fetch(e.request))\
  );\
\});}
