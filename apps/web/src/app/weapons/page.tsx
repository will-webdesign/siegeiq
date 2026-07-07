import type { Metadata } from "next";
import weaponsData from "@siegeiq/game-data/weapons.json";
import operatorsData from "@siegeiq/game-data/operators.json";
import { SectionHeader } from "@/components/ui";
import { WeaponTable } from "@/components/weapons/weapon-table";

export const metadata: Metadata = {
  title: "Weapon database",
  description: "Rainbow Six Siege weapon stats: damage, fire rate, magazine, DPS and who runs it.",
};

export default function WeaponsPage() {
  return (
    <div>
      <SectionHeader
        title="Weapon database"
        sub={`${weaponsData.length} weapons · damage/RPM are community-verified values; ADS/reload are approximations (see src/data/README.md).`}
      />
      <WeaponTable weapons={weaponsData} operators={operatorsData} />
    </div>
  );
}
