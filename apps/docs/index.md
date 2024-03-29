---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Artico"
  text: "WebRTC made simple"
  tagline: Stands for "R-T-COmmunications"
  image:
    src: /logo.png
    alt: Artico logo
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: About
      link: /guide/what-is-artico
    - theme: alt
      text: Demo
      link: https://demo.artico.dev
    - theme: alt
      text: Github
      link: https://github.com/matallui/artico

features:
  - title: Simplified WebRTC
    details: A core @rtco/peer package provides intuitive WebRTC APIs and can be used to build your own custom WebRTC signaling on top of.
  - title: Out-of-the-box Signaling
    details: Artico provides @rtco/client and @rtco/server, which implement the Artico signaling interface via Socket.io, so you can have a working solution in minutes.
  - title: Customization
    details: Artico aims at providing the parts, letting you tailor the WebRTC solution that fits your needs.
---
