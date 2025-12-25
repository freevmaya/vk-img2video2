<?
class PublicationsModel extends BaseModel {
	
	protected function getTable() {
		return 'publications';
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'task_id' => [
				'type' => 'task_id',
				'dbtype' => 'i'
			],
			'data' => [
				'type' => 'data',
				'dbtype' => 's'
			]
		];
	}
}