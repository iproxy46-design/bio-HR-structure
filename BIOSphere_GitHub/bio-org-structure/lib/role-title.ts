/** Capitalize the first letter, preserving abbreviations and the remaining text. */
export function capitalizeRole(value:string):string {
 return value.replace(/\p{L}/u,letter=>letter.toLocaleUpperCase("ru"));
}
