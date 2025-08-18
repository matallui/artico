import { DefaultTheme, defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Artico",
  description: "WebRTC made simple",
  head: [["link", { ref: "icon", href: "/favicon.icon" }]],
  themeConfig: {
    logo: "/logo.png",
    nav: nav(),
    sidebar: {
      "/guide/": {
        base: "/guide/",
        items: guideSidebar(),
      },
      "/reference/": {
        base: "/reference/",
        items: referenceSidebar(),
      },
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/matallui/artico" },
    ],
  },
});

function nav(): DefaultTheme.NavItem[] {
  return [
    { text: "Guide", link: "/guide/what-is-artico", activeMatch: "/guide/" },
    {
      text: "Reference",
      link: "/reference/artico",
      activeMatch: "/reference/",
    },
  ];
}

function guideSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Introduction",
      collapsed: false,
      items: [
        { text: "What is Artico?", link: "what-is-artico" },
        { text: "Getting Started", link: "getting-started" },
        { text: "Voice / Video Example", link: "call-example" },
        { text: "Room Example", link: "room-example" },
        { text: "Using Artico in an Expo App", link: "expo-example" },
      ],
    },
  ];
}

function referenceSidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Reference",
      collapsed: false,
      items: [
        {
          text: "@rtco/client",
          collapsed: false,
          items: [
            { text: "Artico", link: "artico" },
            { text: "Call", link: "call" },
            { text: "Room", link: "room" },
            { text: "SocketSignaling", link: "socket-signaling" },
            { text: "Types & Interfaces", link: "types" },
          ],
        },
        {
          text: "@rtco/peer",
          collapsed: false,
          items: [{ text: "Peer", link: "peer" }],
        },

        {
          text: "@rtco/server",
          collapsed: false,
          items: [{ text: "ArticoServer", link: "artico-server" }],
        },
      ],
    },
  ];
}
