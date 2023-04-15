import { environment, Action, ActionPanel, Grid } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { fetchFiles } from "./utils";
import { Card } from "./types";
import { ReactNode } from "react";

export default function Command() {
	const { isLoading, data } = usePromise(loadGridComponents);

	return (
		<Grid
			columns={5}
			isLoading={isLoading}
			inset={Grid.Inset.Large}
			navigationTitle="Image Wallet"
			searchBarPlaceholder="Search Cards..."
			actions={
				loadEditAction()
			  }
		>
			{ data }
		</Grid>
	);
}

async function loadGridComponents() {
	const outPockets:ReactNode[] = []

	fetchFiles(environment.supportPath).then(pockets => {
		pockets.forEach((pocket) => { outPockets.push(
			<Grid.Section title={pocket.name} key={pocket.name || "unsorted"}>
				{pocket.cards.map(card => (
					<Grid.Item
						key={card.path}
						content={card.path}
						title={card.name}
						actions={loadCardActions(card)}
					/>
				))}
			</Grid.Section>
		)})
	})

	return outPockets
}

function loadCardActions(item: Card) { return (
	<ActionPanel>
		<ActionPanel.Section>
			<Action.Paste content={{ file: item.path }} />
			<Action.CopyToClipboard content={{ file: item.path }} />
		</ActionPanel.Section>
		{loadEditAction()}
	</ActionPanel>
)}

function loadEditAction() { return (
	<ActionPanel.Section>
		<Action.ShowInFinder
			title="Edit Wallet"
			shortcut={{modifiers: ["cmd"], key: "e"}}
			path={environment.supportPath}
		/>
	</ActionPanel.Section>
)}