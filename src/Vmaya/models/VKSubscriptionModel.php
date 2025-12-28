<?
class VKSubscriptionModel extends BaseModel {
	
	protected function getTable() {
		return 'vk_subscription';
	}

	public function get($id, $fieldId = 'user_id', $onlyActive = false) {
		GLOBAL $dbp;

		$where = "s.`{$fieldId}` = {$id}";

		if ($onlyActive) 
			$where .= " AND (s.`status` = 'active' || (s.`status` = 'chargeable' AND (NOW() BETWEEN s.created_at AND s.expired)))";

		return $dbp->line(
				"SELECT s.*, so.name, so.image_limit, so.video_limit, DATE_FORMAT(s.created_at, '%d.%m.%Y %H:%i') AS created_at, DATE_FORMAT(s.expired, '%d.%m.%Y %H:%i') AS expired, ".
				"(SELECT COUNT(t.id) FROM task t WHERE t.`subscription_id` = s.`id`) AS task_count, ".
				" (NOW() > s.`expired`) AS isExpired ".
				"FROM {$this->getTable()} s INNER JOIN `subscribe_options` so ON so.id = s.sub_id ".
				"WHERE {$where} ORDER BY `id` DESC");
	}

	public function Prolong($item) {

		if ($item && (intval($item['isExpired']) == 1)) {
			$so = (new SubscribeOptions())->getItem($item['sub_id']);
			$newExpiried = date('Y-m-d H:i:s', strtotime($item['expired']." +{$so['period']} days"));

			$this->Update([
				'id' => $item['id'],
				'status' => 'expired'
			]);

			unset($item['id']);

			$item['created_at'] = date('Y-m-d H:i:s', strtotime($item['expired']));
			$item['expired'] = $newExpiried;

			$new_id = $this->Update($item);

			return $this->get($new_id, 'id');
		}
		return false;
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