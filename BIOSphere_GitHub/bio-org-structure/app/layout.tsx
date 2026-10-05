import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"БИОсфера — команда компании",description:"Организационная структура и сотрудники БИО",robots:{index:false,follow:false},icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
