<?
class NotificationsModel extends BaseModel {
	
	protected function getTable() {
		return 'notifications';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'user_id' => [
				'type' => 'user_id',
				'dbtype' => 'i'
			],
			'task_id' => [
				'type' => 'task_id',
				'dbtype' => 'i'
			],
			'type' => [
				'type' => 'type',
				'dbtype' => 's'
			],
			'title' => [
				'type' => 'title',
				'dbtype' => 's'
			],
			'message' => [
				'type' => 'message',
				'dbtype' => 's'
			],
			'is_read' => [
				'type' => 'is_read',
				'dbtype' => 'i'
			],
			'created_at' => [
				'type' => 'created_at',
				'dbtype' => 's'
			]
		];
	}
}