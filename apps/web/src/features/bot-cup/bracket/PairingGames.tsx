import { Button } from "../../../shared/ui/Button";
import type { KnockoutGame } from "../BotCupApiGateway";
import { gameLine } from "./bracketFormat";
import styles from "./bracket.module.css";

/** The games of one pairing, each with its replay once it is finished. */
export function PairingGames({ red, blue, games, onOpenReplay }: {
  readonly red: string;
  readonly blue: string;
  readonly games: readonly KnockoutGame[];
  readonly onOpenReplay?: (matchId: string) => void;
}) {
  if (games.length === 0) return null;
  return (
    <ul className={styles.games}>
      {games.map((game) => (
        <li key={game.id}>
          <span>{gameLine(red, blue, game)}</span>
          {onOpenReplay && game.status === "finished" ? (
            <Button variant="secondary" onClick={() => onOpenReplay(game.id)}>Xem replay</Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
