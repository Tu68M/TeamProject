declare module "petrovich" {
  export type PetrovichGender = "male" | "female" | "androgynous";
  export type PetrovichCase =
    | "nominative"
    | "genitive"
    | "dative"
    | "accusative"
    | "instrumental"
    | "prepositional";

  export interface PetrovichPerson {
    first?: string;
    middle?: string;
    last?: string;
    gender?: PetrovichGender;
  }

  interface PetrovichFn {
    (person: PetrovichPerson, grammaticalCase: PetrovichCase): PetrovichPerson;
    detect_gender(middleName: string): PetrovichGender;
  }

  const petrovich: PetrovichFn;
  export default petrovich;
}
