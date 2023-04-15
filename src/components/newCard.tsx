import { Action, ActionPanel, Form } from "@raycast/api";  

import { createCard } from "../utils"

export default function NewCard() {
	console.log("New Card...")

	return (
		<Form
			navigationTitle="New Card"
			actions={
				<ActionPanel>
					<Action.SubmitForm
						onSubmit={createCard}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField
				id="name"
				title="Card Title"
				defaultValue=""
			/>
		</Form>
	);
}