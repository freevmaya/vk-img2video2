<?
class VKSubscriptionModel extends BaseModel {
	
	protected function getTable() {
		return 'vk_subscription';
	}

	public function get($id, $fieldId = 'user_id') {
		GLOBAL $dbp;

		return $dbp->line(
				"SELECT s.*, so.name, so.image_limit, so.video_limit, DATE_FORMAT(s.created_at, '%d.%m.%Y %H:%i') AS created_at, DATE_FORMAT(s.expired, '%d.%m.%Y %H:%i') AS expired, ".
				"(SELECT COUNT(t.id) FROM task t WHERE t.`user_id` = s.`user_id` AND (t.`date` BETWEEN s.`created_at` AND s.`expired`)) AS task_count ".
				"FROM {$this->getTable()} s INNER JOIN `subscribe_options` so ON so.id = s.sub_id ".
				"WHERE s.`{$fieldId}` = {$id} AND (NOW() BETWEEN s.`created_at` AND s.`expired`) ORDER BY `status`");
	}

	public function getFields() {
		return [
			'id' => [
				'type' => 'hidden',
				'dbtype' => 'i'
			],
			'user_id' => [
				'label' => 'user_id',
				'dbtype' => 'i'
			],
			'vk_subscription_id' => [
				'label' => 'vk_subscription_id',
				'dbtype' => 'i'
			],
			'sub_id' => [
				'label' => 'sub_id',
				'dbtype' => 'i'
			],
			'vk_user_id' => [
				'label' => 'vk_user_id',
				'dbtype' => 'i'
			],
			'created_at' => [
				'label' => 'created_at',
				'dbtype' => 's'
			],
			'status' => [
				'label' => 'status',
				'dbtype' => 's'
			],
			'cancel_reason' => [
				'label' => 'cancel_reason',
				'dbtype' => 's'
			],
			'expired' => [
				'label' => 'expired',
				'dbtype' => 's'
			],
			'next_bill_time' => [
				'label' => 'next_bill_time',
				'dbtype' => 's'
			]			
		];
	}
}