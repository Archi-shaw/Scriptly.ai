"use client";

import { 
    Sidebar,
    SidebarContent,
    SidebarMenu,
    SidebarGroup,
    SidebarFooter,
    SidebarHeader,
    useSidebar,
    SidebarGroupContent,
    SidebarMenuItem,
    SidebarGroupLabel,
    SidebarMenuButton} from "@/app/components/ui/sidebar";

import Logo from "@/app/components/Essentials/Logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";


const element = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: "",
    },
    {
        title: "AI Article Writer",
        href: "/aigenerator",
        icon: "",
    },
    {
        title: "All Tools",
        href: "/tools",
        icon: "",
    },
    {
        title: "My Content",
        href: "/mycontent",
        icon: "",
    }
]

const items = [
    {
        title: "Activate",
        href: "/studio",
        icon: "",
    }
]


